import crypto from "node:crypto";

import { updateServiceState } from "./store.js";

function clean(value) {
  return String(value || "").trim();
}

function normalizeDropboxPath(value) {
  const path = clean(value) || "/Product Gen";
  if (path === "/" || path === ".") return "";
  return path.startsWith("/") ? path : `/${path}`;
}

function isSupportedArtwork(path) {
  return /\.(png|jpe?g|svg|pdf|psd)$/i.test(String(path || ""));
}

const TOKEN_CACHE_KEY = Symbol.for("product-gen.dropbox-token");

function getTokenCache() {
  if (!globalThis[TOKEN_CACHE_KEY]) {
    globalThis[TOKEN_CACHE_KEY] = {
      accessToken: null,
      expiresAt: 0
    };
  }
  return globalThis[TOKEN_CACHE_KEY];
}

async function refreshDropboxAccessToken() {
  const refreshToken = clean(process.env.DROPBOX_REFRESH_TOKEN);
  const appKey = clean(process.env.DROPBOX_APP_KEY);
  const appSecret = clean(process.env.DROPBOX_APP_SECRET);

  if (!refreshToken || !appKey || !appSecret) {
    return clean(process.env.DROPBOX_ACCESS_TOKEN);
  }

  const cache = getTokenCache();
  if (cache.accessToken && cache.expiresAt > Date.now() + 60_000) {
    return cache.accessToken;
  }

  const credentials = Buffer.from(`${appKey}:${appSecret}`).toString("base64");
  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    throw new Error(`dropbox_oauth_${response.status}`);
  }

  const result = await response.json();
  cache.accessToken = clean(result?.access_token);
  cache.expiresAt = Date.now() + Math.max(Number(result?.expires_in || 0) - 60, 0) * 1000;
  return cache.accessToken;
}

async function buildDropboxHeaders(contentType = "application/json") {
  const accessToken = await refreshDropboxAccessToken();
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": contentType
  };
}

async function fetchDropboxJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: await buildDropboxHeaders(),
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let detail = body;
    try {
      const parsed = JSON.parse(body);
      detail = parsed.error_summary || parsed.error?.[".tag"] || body;
    } catch {
      detail = body;
    }
    throw new Error(`dropbox_http_${response.status}${detail ? `:${String(detail).slice(0, 240)}` : ""}`);
  }
  return response.json();
}

async function getTemporaryLink(path) {
  try {
    const response = await fetchDropboxJson("https://api.dropboxapi.com/2/files/get_temporary_link", {
      path
    });
    return response?.link || null;
  } catch {
    return null;
  }
}

export async function scanDropboxFolder() {
  const accessToken = await refreshDropboxAccessToken();
  const rootPath = normalizeDropboxPath(process.env.DROPBOX_ROOT_PATH);

  if (!accessToken) return [];

  const seen = [];
  let cursor = null;
  let hasMore = true;

  while (hasMore) {
    const endpoint = cursor
      ? "https://api.dropboxapi.com/2/files/list_folder/continue"
      : "https://api.dropboxapi.com/2/files/list_folder";
    const payload = cursor
      ? { cursor }
      : { path: rootPath, recursive: true, include_deleted: false, include_media_info: false };
    const result = await fetchDropboxJson(endpoint, payload);
    const entries = Array.isArray(result?.entries) ? result.entries : [];

    for (const entry of entries) {
      if (entry[".tag"] !== "file") continue;
      if (!isSupportedArtwork(entry.path_display)) continue;
      const previewUrl = await getTemporaryLink(entry.path_lower || entry.path_display);
      seen.push({
        id:
          entry.id ||
          `dropbox_${crypto.createHash("sha1").update(entry.path_lower || entry.path_display).digest("hex").slice(0, 12)}`,
        filename: clean(entry.name),
        displayName: clean(entry.name).replace(/\.[^.]+$/, ""),
        extension: clean(entry.name).split(".").pop()?.toLowerCase() || "",
        contentHash:
          clean(entry.content_hash) ||
          crypto.createHash("sha1").update(`${entry.path_lower}:${entry.client_modified}`).digest("hex"),
        pathDisplay: clean(entry.path_display),
        sizeBytes: Number(entry.size || 0),
        artworkMode: "remote",
        artworkText: null,
        sourceUrl: previewUrl,
        source: "dropbox",
        status: "ready",
        createdAt: new Date(entry.client_modified || Date.now()).toISOString(),
        updatedAt: new Date(entry.server_modified || entry.client_modified || Date.now()).toISOString()
      });
    }

    cursor = result?.cursor || null;
    hasMore = Boolean(result?.has_more);
  }

  return seen;
}

export async function rescanDesignAssets() {
  const scanned = await scanDropboxFolder();
  if (!scanned.length) {
    const { state } = await updateServiceState((draft) => draft);
    return state.designs;
  }

  const { state } = await updateServiceState((draft) => {
    draft.designs = scanned;
  });
  return state.designs;
}

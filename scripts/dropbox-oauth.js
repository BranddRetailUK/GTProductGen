import "dotenv/config";

const COMMAND = process.argv[2];

function clean(value) {
  return String(value || "").trim();
}

function getDropboxAppKey() {
  return clean(process.env.DROPBOX_APP_KEY || process.argv[3]);
}

function printUsage() {
  console.log(`Usage:
  npm run dropbox:auth-url
  npm run dropbox:exchange-code -- <authorization-code>
  npm run dropbox:test-refresh

Required env:
  DROPBOX_APP_KEY
  DROPBOX_APP_SECRET
  DROPBOX_REFRESH_TOKEN   Required only for dropbox:test-refresh
`);
}

function buildAuthUrl() {
  const appKey = getDropboxAppKey();
  if (!appKey) {
    throw new Error("missing_DROPBOX_APP_KEY");
  }

  const params = new URLSearchParams({
    client_id: appKey,
    response_type: "code",
    token_access_type: "offline"
  });

  return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
}

async function exchangeCode() {
  const code = clean(process.argv[3] || process.env.DROPBOX_AUTH_CODE);
  const appKey = clean(process.env.DROPBOX_APP_KEY);
  const appSecret = clean(process.env.DROPBOX_APP_SECRET);

  if (!code) throw new Error("missing_authorization_code");
  if (!appKey) throw new Error("missing_DROPBOX_APP_KEY");
  if (!appSecret) throw new Error("missing_DROPBOX_APP_SECRET");

  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: appKey,
      client_secret: appSecret
    })
  });

  const text = await response.text();
  let payload = {};
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { error: text };
  }

  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || `dropbox_oauth_${response.status}`);
  }

  if (!payload.refresh_token) {
    throw new Error("missing_refresh_token: confirm the authorization URL included token_access_type=offline");
  }

  console.log("Add these values to .env locally and Railway Variables:");
  console.log(`DROPBOX_REFRESH_TOKEN=${payload.refresh_token}`);
  console.log(`DROPBOX_APP_KEY=${appKey}`);
  console.log("DROPBOX_APP_SECRET=<keep the current Dropbox app secret>");
  console.log("\nAfter this is set, DROPBOX_ACCESS_TOKEN can be removed.");
}

async function testRefreshToken() {
  const refreshToken = clean(process.env.DROPBOX_REFRESH_TOKEN);
  const appKey = clean(process.env.DROPBOX_APP_KEY);
  const appSecret = clean(process.env.DROPBOX_APP_SECRET);

  if (!refreshToken) throw new Error("missing_DROPBOX_REFRESH_TOKEN");
  if (!appKey) throw new Error("missing_DROPBOX_APP_KEY");
  if (!appSecret) throw new Error("missing_DROPBOX_APP_SECRET");

  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${appKey}:${appSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`dropbox_refresh_${response.status}${text ? `:${text.slice(0, 180)}` : ""}`);
  }

  const payload = await response.json();
  console.log(`OK: Dropbox returned a short-lived access token expiring in ${payload.expires_in || "unknown"} seconds.`);
}

try {
  if (COMMAND === "auth-url") {
    console.log(buildAuthUrl());
  } else if (COMMAND === "exchange-code") {
    await exchangeCode();
  } else if (COMMAND === "test-refresh") {
    await testRefreshToken();
  } else {
    printUsage();
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "dropbox_oauth_failed");
  process.exit(1);
}

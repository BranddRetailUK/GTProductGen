"use client";

import { useEffect, useMemo, useState } from "react";

const THUMBNAILABLE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "tif", "tiff", "gif", "webp", "ppm", "bmp"]);

function getDesignThumbnailSrc(design) {
  const extension = String(design?.extension || "").toLowerCase();
  const canLoadDropboxThumbnail =
    design?.source === "dropbox" &&
    design?.pathDisplay &&
    THUMBNAILABLE_EXTENSIONS.has(extension) &&
    Number(design?.sizeBytes || 0) < 20_000_000;

  if (canLoadDropboxThumbnail) {
    return `/api/admin/designs/${encodeURIComponent(String(design.id))}/thumbnail`;
  }

  return null;
}

function getFallbackLabel(design) {
  const extension = String(design?.extension || "").trim();
  if (extension && extension.length <= 4) return extension.toUpperCase();

  return (
    String(design?.displayName || "Artwork")
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "ART"
  );
}

async function readApiPayload(response) {
  const text = await response.text().catch(() => "");
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: response.ok ? "invalid_json_response" : `request_failed_${response.status}`
    };
  }
}

export default function DesignLibraryPanel() {
  const [designs, setDesigns] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetchDesigns();
  }, []);

  async function fetchDesigns() {
    const response = await fetch("/api/admin/designs");
    const payload = await readApiPayload(response);
    if (!response.ok) {
      setStatus(payload?.error || "Unable to load designs.");
      return;
    }
    setDesigns(payload?.designs || []);
  }

  async function handleRescan() {
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/designs/rescan", {
        method: "POST"
      });
      const payload = await readApiPayload(response);
      if (!response.ok) {
        throw new Error(payload?.error || `rescan_failed_${response.status}`);
      }
      setDesigns(payload?.designs || []);
      setStatus("Design library rescanned.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to rescan designs.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pg-admin-panel">
      <div className="pg-page-head">
        <p className="pg-kicker">Design Library</p>
        <h2>Dropbox-sourced artwork index</h2>
      </div>

      <div className="pg-toolbar">
        <button type="button" className="pg-primary-button" onClick={handleRescan} disabled={loading}>
          {loading ? "Rescanning..." : "Rescan Dropbox"}
        </button>
        {status ? <span className="pg-muted-copy">{status}</span> : null}
      </div>

      <div className="pg-table">
        {(designs || []).map((design) => (
          <div key={design.id} className="pg-table-row pg-design-table-row">
            <span className="pg-design-title-cell">
              <DesignThumbnail design={design} />
              <strong>{design.displayName}</strong>
            </span>
            <span>{design.filename}</span>
            <span>{design.source}</span>
            <span>{design.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DesignThumbnail({ design }) {
  const [imageError, setImageError] = useState(false);
  const thumbnailSrc = useMemo(() => getDesignThumbnailSrc(design), [design]);

  useEffect(() => {
    setImageError(false);
  }, [thumbnailSrc]);

  return (
    <span className="pg-design-thumb" aria-hidden="true">
      {thumbnailSrc && !imageError ? (
        <img
          src={thumbnailSrc}
          alt=""
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="pg-design-thumb-fallback">{getFallbackLabel(design)}</span>
      )}
    </span>
  );
}

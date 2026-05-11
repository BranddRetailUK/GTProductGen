"use client";

import { useEffect, useState } from "react";

export default function DesignLibraryPanel() {
  const [designs, setDesigns] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetchDesigns();
  }, []);

  async function fetchDesigns() {
    const response = await fetch("/api/admin/designs");
    const payload = await response.json();
    setDesigns(payload?.designs || []);
  }

  async function handleRescan() {
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/designs/rescan", {
        method: "POST"
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "rescan_failed");
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
          {loading ? "RESCANNING..." : "RESCAN DROPBOX"}
        </button>
        {status ? <span className="pg-muted-copy">{status}</span> : null}
      </div>

      <div className="pg-table">
        {(designs || []).map((design) => (
          <div key={design.id} className="pg-table-row">
            <strong>{design.displayName}</strong>
            <span>{design.filename}</span>
            <span>{design.source}</span>
            <span>{design.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

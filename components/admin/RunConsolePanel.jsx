"use client";

import { useEffect, useMemo, useState } from "react";

import { RUN_MODE_BULK, RUN_MODE_SINGLE } from "../../lib/constants.js";

export default function RunConsolePanel() {
  const [templates, setTemplates] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [runs, setRuns] = useState([]);
  const [mode, setMode] = useState(RUN_MODE_SINGLE);
  const [templateIds, setTemplateIds] = useState([]);
  const [designIds, setDesignIds] = useState([]);
  const [forceRerun, setForceRerun] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    void Promise.all([fetchTemplates(), fetchDesigns(), fetchRuns()]);
  }, []);

  async function fetchTemplates() {
    const response = await fetch("/api/admin/templates");
    const payload = await response.json();
    setTemplates(payload?.templates || []);
  }

  async function fetchDesigns() {
    const response = await fetch("/api/admin/designs");
    const payload = await response.json();
    setDesigns(payload?.designs || []);
  }

  async function fetchRuns() {
    const response = await fetch("/api/admin/runs");
    const payload = await response.json();
    setRuns(payload?.runs || []);
  }

  const effectiveDesignIds = useMemo(() => {
    if (mode === RUN_MODE_BULK) return [];
    return designIds.slice(0, 1);
  }, [designIds, mode]);

  async function handleCreateRun(event) {
    event.preventDefault();
    setStatus("");

    const response = await fetch("/api/admin/runs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mode,
        designIds: effectiveDesignIds,
        templateIds,
        forceRerun
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload?.error || "run_creation_failed");
      return;
    }
    setStatus(`Run queued: ${payload.run.id}`);
    await fetchRuns();
  }

  return (
    <div className="pg-admin-panel">
      <div className="pg-page-head">
        <p className="pg-kicker">Run Console</p>
        <h2>Single or bulk template-first generation</h2>
      </div>

      <form className="pg-admin-form" onSubmit={handleCreateRun}>
        <div className="pg-toggle-row">
          <label>
            <input type="radio" checked={mode === RUN_MODE_SINGLE} onChange={() => setMode(RUN_MODE_SINGLE)} />
            Single design
          </label>
          <label>
            <input type="radio" checked={mode === RUN_MODE_BULK} onChange={() => setMode(RUN_MODE_BULK)} />
            Bulk all designs
          </label>
          <label>
            <input type="checkbox" checked={forceRerun} onChange={(event) => setForceRerun(event.target.checked)} />
            Force rerun
          </label>
        </div>

        <div className="pg-admin-grid">
          <div className="pg-admin-checklist">
            <strong>Select templates</strong>
            {templates.map((template) => (
              <label key={template.id}>
                <input
                  type="checkbox"
                  checked={templateIds.includes(String(template.id))}
                  onChange={(event) =>
                    setTemplateIds((current) =>
                      event.target.checked
                        ? [...current, String(template.id)]
                        : current.filter((entry) => entry !== String(template.id))
                    )
                  }
                />
                {template.title}
              </label>
            ))}
          </div>

          {mode === RUN_MODE_SINGLE ? (
            <div className="pg-admin-checklist">
              <strong>Select one design</strong>
              {designs.map((design) => (
                <label key={design.id}>
                  <input
                    type="checkbox"
                    checked={designIds.includes(String(design.id))}
                    onChange={(event) =>
                      setDesignIds(event.target.checked ? [String(design.id)] : [])
                    }
                  />
                  {design.displayName}
                </label>
              ))}
            </div>
          ) : (
            <div className="pg-empty-state">
              <p>Bulk mode uses every indexed design in the library.</p>
            </div>
          )}
        </div>

        {status ? <p className="pg-muted-copy">{status}</p> : null}
        <button type="submit" className="pg-primary-button">
          Create run
        </button>
      </form>

      <div className="pg-table">
        {runs.map((run) => (
          <div key={run.id} className="pg-table-row">
            <strong>{run.id}</strong>
            <span>{run.mode}</span>
            <span>{run.status}</span>
            <span>
              {run.completedCount} complete / {run.failedCount} failed / {run.queuedCount} queued
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

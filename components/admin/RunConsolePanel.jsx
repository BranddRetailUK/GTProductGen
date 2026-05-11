"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { RUN_MODE_BULK, RUN_MODE_SINGLE, RUN_STATUS_QUEUED, RUN_STATUS_RUNNING } from "../../lib/constants.js";

const ACTIVE_RUN_STATUSES = new Set([RUN_STATUS_QUEUED, RUN_STATUS_RUNNING]);

export default function RunConsolePanel() {
  const [templates, setTemplates] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [runs, setRuns] = useState([]);
  const [mode, setMode] = useState(RUN_MODE_SINGLE);
  const [templateIds, setTemplateIds] = useState([]);
  const [designIds, setDesignIds] = useState([]);
  const [forceRerun, setForceRerun] = useState(false);
  const [status, setStatus] = useState("");

  const fetchTemplates = useCallback(async () => {
    const response = await fetch("/api/admin/templates");
    const payload = await response.json();
    setTemplates(payload?.templates || []);
  }, []);

  const fetchDesigns = useCallback(async () => {
    const response = await fetch("/api/admin/designs");
    const payload = await response.json();
    setDesigns(payload?.designs || []);
  }, []);

  const fetchRuns = useCallback(async () => {
    const response = await fetch("/api/admin/runs", { cache: "no-store" });
    const payload = await response.json();
    setRuns(payload?.runs || []);
  }, []);

  useEffect(() => {
    void Promise.all([fetchTemplates(), fetchDesigns(), fetchRuns()]);
  }, [fetchDesigns, fetchRuns, fetchTemplates]);

  const hasActiveRuns = useMemo(() => runs.some((run) => ACTIVE_RUN_STATUSES.has(run.status)), [runs]);

  useEffect(() => {
    if (!hasActiveRuns) return undefined;

    const intervalId = window.setInterval(() => {
      void fetchRuns();
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [fetchRuns, hasActiveRuns]);

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
    setStatus(`Run created: ${payload.run.id}`);
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
          <RunTableRow key={run.id} run={run} />
        ))}
      </div>
    </div>
  );
}

function RunTableRow({ run }) {
  const remainingCount = Math.max(
    0,
    Number(run.queuedCount || 0) - Number(run.completedCount || 0) - Number(run.failedCount || 0)
  );

  return (
    <div className="pg-table-row">
      <strong>{run.id}</strong>
      <span>{run.mode}</span>
      <span>{run.status}</span>
      <span>
        {run.completedCount} complete / {run.failedCount} failed / {remainingCount} remaining / {run.queuedCount} total
      </span>
    </div>
  );
}

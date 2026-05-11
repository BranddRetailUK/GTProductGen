"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { RUN_MODE_BULK, RUN_MODE_SINGLE, RUN_STATUS_QUEUED, RUN_STATUS_RUNNING } from "../../lib/constants.js";

const ACTIVE_RUN_STATUSES = new Set([RUN_STATUS_QUEUED, RUN_STATUS_RUNNING]);

export default function RunConsolePanel() {
  const router = useRouter();
  const [templates, setTemplates] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [runs, setRuns] = useState([]);
  const [mode, setMode] = useState(RUN_MODE_SINGLE);
  const [templateIds, setTemplateIds] = useState([]);
  const [designIds, setDesignIds] = useState([]);
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
    return designIds;
  }, [designIds, mode]);

  const allDesignIds = useMemo(() => designs.map((design) => String(design.id)), [designs]);
  const selectedDesignCount = useMemo(
    () => designIds.filter((id) => allDesignIds.includes(String(id))).length,
    [allDesignIds, designIds]
  );
  const allDesignsSelected = allDesignIds.length > 0 && selectedDesignCount === allDesignIds.length;

  function toggleTemplate(templateId, isChecked) {
    const nextId = String(templateId);
    setTemplateIds((current) =>
      isChecked
        ? Array.from(new Set([...current, nextId]))
        : current.filter((entry) => String(entry) !== nextId)
    );
  }

  function toggleDesign(designId, isChecked) {
    const nextId = String(designId);
    setDesignIds((current) =>
      isChecked
        ? Array.from(new Set([...current, nextId]))
        : current.filter((entry) => String(entry) !== nextId)
    );
  }

  async function handleCreateRun(event) {
    event.preventDefault();
    setStatus("");

    if (!templateIds.length) {
      setStatus("Select at least one template.");
      return;
    }
    if (mode === RUN_MODE_SINGLE && !effectiveDesignIds.length) {
      setStatus("Select at least one artwork.");
      return;
    }

    const response = await fetch("/api/admin/runs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mode,
        designIds: effectiveDesignIds,
        templateIds
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload?.error || "run_creation_failed");
      return;
    }
    setStatus(`Run created: ${payload.run.id}. Shopify draft creation is included.`);
    await fetchRuns();
    router.push(`/admin/runs/${payload.run.id}`);
  }

  return (
    <div className="pg-admin-panel">
      <div className="pg-page-head">
        <p className="pg-kicker">Run Console</p>
        <h2>Generate imagery and Shopify drafts</h2>
      </div>

      <form className="pg-admin-form" onSubmit={handleCreateRun}>
        <div className="pg-toggle-row">
          <label>
            <input type="radio" checked={mode === RUN_MODE_SINGLE} onChange={() => setMode(RUN_MODE_SINGLE)} />
            Selected artworks
          </label>
          <label>
            <input type="radio" checked={mode === RUN_MODE_BULK} onChange={() => setMode(RUN_MODE_BULK)} />
            Bulk all artworks
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
                  onChange={(event) => toggleTemplate(template.id, event.target.checked)}
                />
                {template.title}
              </label>
            ))}
          </div>

          {mode === RUN_MODE_SINGLE ? (
            <div className="pg-admin-checklist">
              <div className="pg-checklist-head">
                <strong>Select artworks</strong>
                <span>
                  {selectedDesignCount}/{allDesignIds.length}
                </span>
              </div>
              <div className="pg-toggle-row">
                <button
                  type="button"
                  className="pg-inline-button"
                  onClick={() => setDesignIds(allDesignIds)}
                  disabled={allDesignsSelected || !allDesignIds.length}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="pg-outline-button"
                  onClick={() => setDesignIds([])}
                  disabled={!designIds.length}
                >
                  Clear
                </button>
              </div>
              {designs.map((design) => (
                <label key={design.id}>
                  <input
                    type="checkbox"
                    checked={designIds.includes(String(design.id))}
                    onChange={(event) => toggleDesign(design.id, event.target.checked)}
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
          Create images + Shopify drafts
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
      <Link href={`/admin/runs/${run.id}`} className="pg-inline-link">
        View status
      </Link>
      <span>{run.mode}</span>
      <span>{run.status}</span>
      <span>{run.publishToShopify === false ? "local only" : "Shopify drafts"}</span>
      <span>
        {run.completedCount} complete / {run.failedCount} failed / {remainingCount} remaining / {run.queuedCount} total
      </span>
    </div>
  );
}

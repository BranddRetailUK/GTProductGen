"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ITEM_STATUS_COMPLETED,
  ITEM_STATUS_SKIPPED,
  RUN_STATUS_QUEUED,
  RUN_STATUS_RUNNING
} from "../../lib/constants.js";

const ACTIVE_RUN_STATUSES = new Set([RUN_STATUS_QUEUED, RUN_STATUS_RUNNING]);

function formatDate(value) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(new Date(value));
}

function getRemainingCount(run) {
  return Math.max(
    0,
    Number(run?.queuedCount || 0) - Number(run?.completedCount || 0) - Number(run?.failedCount || 0)
  );
}

export default function RunDetailPanel({ runId }) {
  const [run, setRun] = useState(null);
  const [error, setError] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState(null);

  const fetchRun = useCallback(async () => {
    const response = await fetch(`/api/admin/runs/${encodeURIComponent(runId)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || "run_fetch_failed");
    }
    setRun(payload.run || null);
    setError("");
    setLastLoadedAt(new Date());
  }, [runId]);

  useEffect(() => {
    void fetchRun().catch((fetchError) => {
      setError(fetchError instanceof Error ? fetchError.message : "run_fetch_failed");
    });
  }, [fetchRun]);

  const isActive = ACTIVE_RUN_STATUSES.has(run?.status);

  useEffect(() => {
    if (!isActive) return undefined;

    const intervalId = window.setInterval(() => {
      void fetchRun().catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : "run_fetch_failed");
      });
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, [fetchRun, isActive]);

  const statusCounts = useMemo(() => {
    return (run?.items || []).reduce(
      (counts, item) => ({
        ...counts,
        [item.status]: Number(counts[item.status] || 0) + 1
      }),
      {}
    );
  }, [run]);

  const generatedImages = useMemo(() => {
    return (run?.items || []).flatMap((item) =>
      item.status === ITEM_STATUS_COMPLETED
        ? (item.product?.images || []).map((image) => ({
            ...image,
            itemId: item.id,
            productTitle: item.product?.title,
            productId: item.product?.id,
            status: item.status
          }))
        : []
    );
  }, [run]);

  const reusedImages = useMemo(() => {
    return (run?.items || []).flatMap((item) =>
      item.status === ITEM_STATUS_SKIPPED
        ? (item.product?.images || []).map((image) => ({
            ...image,
            itemId: item.id,
            productTitle: item.product?.title,
            productId: item.product?.id,
            status: item.status
          }))
        : []
    );
  }, [run]);

  return (
    <div className="pg-admin-panel">
      <div className="pg-page-head">
        <p className="pg-kicker">Run status</p>
        <h2>{run?.id || runId}</h2>
        <p>
          {run ? `${run.status} · ${run.completedCount} complete · ${run.failedCount} failed` : "Loading run status"}
        </p>
      </div>

      <div className="pg-toolbar">
        <Link href="/admin/runs" className="pg-inline-button">
          Back to runs
        </Link>
        {lastLoadedAt ? <span className="pg-muted-copy">Updated {formatDate(lastLoadedAt.toISOString())}</span> : null}
      </div>

      {error ? <p className="pg-error-copy">{error}</p> : null}

      {run ? (
        <>
          <div className="pg-run-summary-grid">
            <RunSummaryCard label="Status" value={run.status} />
            <RunSummaryCard label="Processed" value={`${run.completedCount}/${run.queuedCount}`} />
            <RunSummaryCard label="Skipped" value={String(statusCounts[ITEM_STATUS_SKIPPED] || 0)} />
            <RunSummaryCard label="Remaining" value={String(getRemainingCount(run))} />
            <RunSummaryCard label="Mode" value={run.mode} />
            <RunSummaryCard label="Force rerun" value={run.forceRerun ? "Yes" : "No"} />
            <RunSummaryCard label="Started" value={formatDate(run.startedAt)} />
          </div>

          <section className="pg-run-section">
            <div className="pg-section-head-clean">
              <h3>Generated this run</h3>
              <span>{generatedImages.length}</span>
            </div>
            {generatedImages.length ? (
              <div className="pg-run-image-grid">
                {generatedImages.map((image) => (
                  <a
                    key={`${image.itemId}:${image.id}:${image.imageUrl}`}
                    href={image.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="pg-run-image-card"
                  >
                    <span className="pg-run-image-frame">
                      <img src={image.imageUrl} alt={image.productTitle || "Generated product"} />
                    </span>
                    <strong>{image.productTitle || image.productId}</strong>
                    <span>
                      {image.colourName || "Default"} · {image.viewId || "front"}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="pg-empty-state">
                <p>No new images were generated in this run.</p>
              </div>
            )}
          </section>

          {reusedImages.length ? (
            <section className="pg-run-section">
              <div className="pg-section-head-clean">
                <h3>Existing images reused</h3>
                <span>{reusedImages.length}</span>
              </div>
              <div className="pg-run-note">
                <p>
                  These images came from existing product records because matching products already existed. Enable Force
                  rerun when creating a run to render and upload fresh Cloudinary images.
                </p>
              </div>
              <div className="pg-run-image-grid">
                {reusedImages.map((image) => (
                  <a
                    key={`${image.itemId}:${image.id}:${image.imageUrl}`}
                    href={image.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="pg-run-image-card"
                  >
                    <span className="pg-run-image-frame">
                      <img src={image.imageUrl} alt={image.productTitle || "Existing product"} />
                    </span>
                    <strong>{image.productTitle || image.productId}</strong>
                    <span>
                      {image.colourName || "Default"} · {image.viewId || "front"}
                    </span>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          <section className="pg-run-section">
            <div className="pg-section-head-clean">
              <h3>Items</h3>
              <span>{run.items?.length || 0}</span>
            </div>
            <div className="pg-run-item-list">
              {(run.items || []).map((item) => (
                <RunItemCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        </>
      ) : (
        <div className="pg-empty-state">
          <p>Loading run.</p>
        </div>
      )}
    </div>
  );
}

function RunSummaryCard({ label, value }) {
  return (
    <div className="pg-run-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RunItemCard({ item }) {
  const primaryImage = item.product?.heroImageUrl || item.product?.images?.[0]?.imageUrl || null;

  return (
    <article className="pg-run-item-card">
      <div className="pg-run-item-copy">
        <div className="pg-run-item-head">
          <strong>{item.template?.title || item.templateId}</strong>
          <span className={`pg-run-status-badge is-${item.status}`}>{item.status}</span>
        </div>
        <span>{item.design?.displayName || item.designId}</span>
        {item.product ? <span>{item.product.title}</span> : null}
        {item.status === ITEM_STATUS_SKIPPED ? (
          <p className="pg-muted-copy">Existing product reused. Force rerun is required for a fresh render/upload.</p>
        ) : null}
        {item.errorMessage ? <p className="pg-error-copy">{item.errorMessage}</p> : null}
      </div>

      {primaryImage ? (
        <a href={primaryImage} target="_blank" rel="noreferrer" className="pg-run-item-thumb">
          <img src={primaryImage} alt={item.product?.title || item.template?.title || "Generated product"} />
        </a>
      ) : (
        <div className="pg-run-item-thumb is-empty">
          <span>{item.status}</span>
        </div>
      )}
    </article>
  );
}

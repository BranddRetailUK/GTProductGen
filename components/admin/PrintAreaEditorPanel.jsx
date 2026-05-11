"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_AREA = {
  id: "front",
  viewId: "front",
  label: "Front",
  x: 0.26,
  y: 0.16,
  width: 0.48,
  height: 0.56
};

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function roundArea(area) {
  return {
    ...area,
    x: Number(clamp(area.x).toFixed(4)),
    y: Number(clamp(area.y).toFixed(4)),
    width: Number(clamp(area.width, 0.02, 1).toFixed(4)),
    height: Number(clamp(area.height, 0.02, 1).toFixed(4))
  };
}

function normalizeArea(area, viewId) {
  return roundArea({
    ...DEFAULT_AREA,
    ...(area || {}),
    id: area?.id || viewId || DEFAULT_AREA.id,
    viewId: area?.viewId || viewId || DEFAULT_AREA.viewId,
    label: area?.label || String(viewId || DEFAULT_AREA.viewId)
  });
}

function getViewOptions(template) {
  const ids = new Set(["front"]);
  for (const asset of template?.viewAssets || []) {
    if (asset?.viewId) ids.add(String(asset.viewId));
  }
  for (const area of template?.printAreas || []) {
    if (area?.viewId) ids.add(String(area.viewId));
  }
  return Array.from(ids);
}

function getColourOptions(template, viewId) {
  const colours = (template?.viewAssets || [])
    .filter((asset) => String(asset?.viewId || "front") === String(viewId || "front"))
    .map((asset) => asset?.colourName)
    .filter(Boolean);
  return Array.from(new Set(colours));
}

function findPreviewAsset(template, viewId, colourName) {
  const assets = Array.isArray(template?.viewAssets) ? template.viewAssets : [];
  return (
    assets.find(
      (asset) =>
        String(asset?.viewId || "front") === String(viewId || "front") &&
        asset?.colourName &&
        String(asset.colourName) === String(colourName || "")
    ) ||
    assets.find((asset) => String(asset?.viewId || "front") === String(viewId || "front") && !asset?.colourName) ||
    assets.find((asset) => String(asset?.viewId || "front") === String(viewId || "front")) ||
    assets[0] ||
    null
  );
}

function getPointerPosition(event, element) {
  const rect = element.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width),
    y: clamp((event.clientY - rect.top) / rect.height)
  };
}

export default function PrintAreaEditorPanel() {
  const stageRef = useRef(null);
  const interactionRef = useRef(null);
  const didHydrateRef = useRef(false);
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedViewId, setSelectedViewId] = useState("front");
  const [selectedColourName, setSelectedColourName] = useState("");
  const [area, setArea] = useState(DEFAULT_AREA);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const selectedTemplate = useMemo(
    () => templates.find((template) => String(template.id) === String(selectedId)) || null,
    [selectedId, templates]
  );
  const viewOptions = useMemo(() => getViewOptions(selectedTemplate), [selectedTemplate]);
  const colourOptions = useMemo(() => getColourOptions(selectedTemplate, selectedViewId), [selectedTemplate, selectedViewId]);
  const previewAsset = useMemo(
    () => findPreviewAsset(selectedTemplate, selectedViewId, selectedColourName),
    [selectedColourName, selectedTemplate, selectedViewId]
  );

  const hydrateSelection = useCallback((template, nextViewId = null) => {
    const views = getViewOptions(template);
    const viewId = nextViewId || views[0] || "front";
    const printArea = (template?.printAreas || []).find((entry) => String(entry?.viewId || "front") === String(viewId));
    const colours = getColourOptions(template, viewId);

    setSelectedId(String(template?.id || ""));
    setSelectedViewId(viewId);
    setSelectedColourName(colours[0] || "");
    setArea(normalizeArea(printArea, viewId));
    setStatus("");
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/templates", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "templates_load_failed");
      }
      const nextTemplates = payload?.templates || [];
      setTemplates(nextTemplates);
      if (!didHydrateRef.current && nextTemplates[0]) {
        didHydrateRef.current = true;
        hydrateSelection(nextTemplates[0]);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load templates.");
    } finally {
      setIsLoading(false);
    }
  }, [hydrateSelection]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  function handleViewChange(viewId) {
    setSelectedViewId(viewId);
    const printArea = (selectedTemplate?.printAreas || []).find((entry) => String(entry?.viewId || "front") === String(viewId));
    const colours = getColourOptions(selectedTemplate, viewId);
    setSelectedColourName(colours[0] || "");
    setArea(normalizeArea(printArea, viewId));
  }

  function startInteraction(event, action) {
    if (!stageRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    interactionRef.current = {
      action,
      start: getPointerPosition(event, stageRef.current),
      area
    };
  }

  function handlePointerMove(event) {
    const interaction = interactionRef.current;
    if (!interaction || !stageRef.current) return;

    const pointer = getPointerPosition(event, stageRef.current);
    const deltaX = pointer.x - interaction.start.x;
    const deltaY = pointer.y - interaction.start.y;
    const startArea = interaction.area;

    if (interaction.action === "move") {
      setArea(
        roundArea({
          ...startArea,
          x: clamp(startArea.x + deltaX, 0, 1 - startArea.width),
          y: clamp(startArea.y + deltaY, 0, 1 - startArea.height)
        })
      );
      return;
    }

    setArea(
      roundArea({
        ...startArea,
        width: clamp(startArea.width + deltaX, 0.02, 1 - startArea.x),
        height: clamp(startArea.height + deltaY, 0.02, 1 - startArea.y)
      })
    );
  }

  function stopInteraction() {
    interactionRef.current = null;
  }

  function updateAreaValue(key, value) {
    setArea((current) => {
      const next = roundArea({
        ...current,
        [key]: Number(value) / 100
      });
      return roundArea({
        ...next,
        x: clamp(next.x, 0, 1 - next.width),
        y: clamp(next.y, 0, 1 - next.height)
      });
    });
  }

  async function handleSave() {
    if (!selectedTemplate) return;
    setStatus("");
    setIsSaving(true);

    const nextArea = normalizeArea(
      {
        ...area,
        id: selectedViewId,
        viewId: selectedViewId,
        label: selectedViewId === "front" ? "Front" : selectedViewId
      },
      selectedViewId
    );
    const nextPrintAreas = [
      ...(selectedTemplate.printAreas || []).filter((entry) => String(entry?.viewId || "front") !== String(selectedViewId)),
      nextArea
    ];

    try {
      const response = await fetch(`/api/admin/templates/${selectedTemplate.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          printAreas: nextPrintAreas
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "save_failed");
      }

      setStatus("Print area saved.");
      setTemplates((current) =>
        current.map((template) => (String(template.id) === String(payload.template?.id) ? payload.template : template))
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save print area.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="pg-admin-panel">
      <div className="pg-page-head">
        <p className="pg-kicker">Print areas</p>
        <h2>Visual template placement</h2>
        <p>Set the artwork box used by image generation for each template view.</p>
      </div>

      <div className="pg-print-area-layout">
        <section className="pg-print-editor-panel">
          <div className="pg-print-editor-toolbar">
            <label className="pg-selector-group">
              <span>View</span>
              <select value={selectedViewId} onChange={(event) => handleViewChange(event.target.value)}>
                {viewOptions.map((viewId) => (
                  <option key={viewId} value={viewId}>
                    {viewId}
                  </option>
                ))}
              </select>
            </label>
            <label className="pg-selector-group">
              <span>Preview colour</span>
              <select
                value={selectedColourName}
                onChange={(event) => setSelectedColourName(event.target.value)}
                disabled={!colourOptions.length}
              >
                {colourOptions.length ? (
                  colourOptions.map((colourName) => (
                    <option key={colourName} value={colourName}>
                      {colourName}
                    </option>
                  ))
                ) : (
                  <option value="">Default</option>
                )}
              </select>
            </label>
            <button type="button" className="pg-primary-button" onClick={handleSave} disabled={!selectedTemplate || isSaving}>
              {isSaving ? "Saving..." : "Save print area"}
            </button>
            {status ? (
              <span className="pg-muted-copy" aria-live="polite">
                {status}
              </span>
            ) : null}
          </div>

          <div
            ref={stageRef}
            className="pg-print-stage"
            onPointerMove={handlePointerMove}
            onPointerUp={stopInteraction}
            onPointerCancel={stopInteraction}
          >
            {previewAsset?.assetUrl ? (
              <img src={previewAsset.assetUrl} alt={selectedTemplate?.title || "Template product"} />
            ) : (
              <div className="pg-print-stage-empty">No base image mapped for this template view.</div>
            )}
            <div
              className="pg-print-area-box"
              style={{
                left: `${area.x * 100}%`,
                top: `${area.y * 100}%`,
                width: `${area.width * 100}%`,
                height: `${area.height * 100}%`
              }}
              onPointerDown={(event) => startInteraction(event, "move")}
            >
              <span>Print area</span>
              <button
                type="button"
                className="pg-print-area-handle"
                aria-label="Resize print area"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  startInteraction(event, "resize");
                }}
              />
            </div>
          </div>

          <div className="pg-print-values">
            {[
              ["x", "X"],
              ["y", "Y"],
              ["width", "Width"],
              ["height", "Height"]
            ].map(([key, label]) => (
              <label key={key} className="pg-selector-group">
                <span>{label} %</span>
                <input
                  type="number"
                  min={key === "width" || key === "height" ? 2 : 0}
                  max={100}
                  step={0.1}
                  value={Number((area[key] * 100).toFixed(1))}
                  onChange={(event) => updateAreaValue(key, event.target.value)}
                />
              </label>
            ))}
          </div>
        </section>

        <aside className="pg-print-template-panel">
          <div className="pg-section-head-clean">
            <h3>Template products</h3>
            <span>{templates.length}</span>
          </div>
          <div className="pg-print-template-list">
            {isLoading ? <p className="pg-muted-copy">Loading templates...</p> : null}
            {!isLoading && !templates.length ? <p className="pg-muted-copy">No templates found.</p> : null}
            {templates.map((template) => {
              const asset = findPreviewAsset(template, "front", "");
              return (
                <button
                  key={template.id}
                  type="button"
                  className={`pg-print-template-item${String(template.id) === selectedId ? " is-active" : ""}`}
                  onClick={() => hydrateSelection(template)}
                >
                  <span className="pg-print-template-thumb">
                    {asset?.assetUrl ? <img src={asset.assetUrl} alt="" /> : null}
                  </span>
                  <span>
                    <strong>{template.title}</strong>
                    <small>
                      {template.productType} · {(template.variants || []).length} variants · {(template.printAreas || []).length} areas
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

function prettyJson(value) {
  return JSON.stringify(value ?? null, null, 2);
}

export default function TemplateAdminPanel() {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [formState, setFormState] = useState({
    title: "",
    productType: "",
    printAreas: "[]",
    viewAssets: "[]"
  });
  const [status, setStatus] = useState("");

  useEffect(() => {
    void fetchTemplates();
  }, []);

  async function fetchTemplates() {
    const response = await fetch("/api/admin/templates");
    const payload = await response.json();
    const nextTemplates = payload?.templates || [];
    setTemplates(nextTemplates);
    if (!selectedId && nextTemplates[0]) {
      hydrateForm(nextTemplates[0]);
    }
  }

  function hydrateForm(template) {
    setSelectedId(String(template.id));
    setFormState({
      title: template.title || "",
      productType: template.productType || "",
      printAreas: prettyJson(template.printAreas || []),
      viewAssets: prettyJson(template.viewAssets || [])
    });
  }

  async function handleSave(event) {
    event.preventDefault();
    setStatus("");

    try {
      const response = await fetch(`/api/admin/templates/${selectedId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: formState.title,
          productType: formState.productType,
          printAreas: JSON.parse(formState.printAreas),
          viewAssets: JSON.parse(formState.viewAssets)
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "save_failed");
      }
      setStatus("Template saved.");
      await fetchTemplates();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save template.");
    }
  }

  return (
    <div className="pg-admin-panel">
      <div className="pg-page-head">
        <p className="pg-kicker">Templates</p>
        <h2>Template products, print areas, and view assets</h2>
      </div>

      <div className="pg-admin-grid">
        <div className="pg-admin-list">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              className={`pg-admin-list-item${String(template.id) === selectedId ? " is-active" : ""}`}
              onClick={() => hydrateForm(template)}
            >
              <strong>{template.title}</strong>
              <span>{template.productType}</span>
            </button>
          ))}
        </div>

        <form className="pg-admin-form" onSubmit={handleSave}>
          <label className="pg-selector-group">
            <span>Title</span>
            <input
              value={formState.title}
              onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
            />
          </label>
          <label className="pg-selector-group">
            <span>Product type</span>
            <input
              value={formState.productType}
              onChange={(event) => setFormState((current) => ({ ...current, productType: event.target.value }))}
            />
          </label>
          <label className="pg-selector-group">
            <span>Print areas JSON</span>
            <textarea
              rows={10}
              value={formState.printAreas}
              onChange={(event) => setFormState((current) => ({ ...current, printAreas: event.target.value }))}
            />
          </label>
          <label className="pg-selector-group">
            <span>View assets JSON</span>
            <textarea
              rows={10}
              value={formState.viewAssets}
              onChange={(event) => setFormState((current) => ({ ...current, viewAssets: event.target.value }))}
            />
          </label>
          {status ? <p className="pg-muted-copy">{status}</p> : null}
          <button type="submit" className="pg-primary-button">
            Save template
          </button>
        </form>
      </div>
    </div>
  );
}

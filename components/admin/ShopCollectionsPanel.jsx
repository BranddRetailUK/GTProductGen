"use client";

import { useEffect, useState } from "react";

export default function ShopCollectionsPanel() {
  const [collections, setCollections] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [formState, setFormState] = useState({
    label: "",
    description: "",
    cardImageUrl: "",
    homepageVisible: true,
    navVisible: true
  });
  const [status, setStatus] = useState("");

  useEffect(() => {
    void fetchCollections();
  }, []);

  async function fetchCollections() {
    const response = await fetch("/api/admin/shop-collections");
    const payload = await response.json();
    const nextCollections = payload?.collections || [];
    setCollections(nextCollections);
    if (!selectedId && nextCollections[0]) {
      selectCollection(nextCollections[0]);
    }
  }

  function selectCollection(collection) {
    setSelectedId(String(collection.id));
    setFormState({
      label: collection.label || "",
      description: collection.description || "",
      cardImageUrl: collection.cardImageUrl || "",
      homepageVisible: Boolean(collection.homepageVisible),
      navVisible: Boolean(collection.navVisible)
    });
  }

  async function handleSave(event) {
    event.preventDefault();
    setStatus("");
    const response = await fetch(`/api/admin/shop-collections/${selectedId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(formState)
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload?.error || "save_failed");
      return;
    }
    setStatus("Shop collection saved.");
    await fetchCollections();
  }

  return (
    <div className="pg-admin-panel">
      <div className="pg-page-head">
        <p className="pg-kicker">Homepage Collections</p>
        <h2>Control homepage cards and navigation visibility</h2>
      </div>

      <div className="pg-admin-grid">
        <div className="pg-admin-list">
          {collections.map((collection) => (
            <button
              key={collection.id}
              type="button"
              className={`pg-admin-list-item${String(collection.id) === selectedId ? " is-active" : ""}`}
              onClick={() => selectCollection(collection)}
            >
              <strong>{collection.label}</strong>
              <span>{collection.slug}</span>
            </button>
          ))}
        </div>

        <form className="pg-admin-form" onSubmit={handleSave}>
          <label className="pg-selector-group">
            <span>Label</span>
            <input
              value={formState.label}
              onChange={(event) => setFormState((current) => ({ ...current, label: event.target.value }))}
            />
          </label>
          <label className="pg-selector-group">
            <span>Description</span>
            <textarea
              rows={6}
              value={formState.description}
              onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
            />
          </label>
          <label className="pg-selector-group">
            <span>Card image URL</span>
            <input
              value={formState.cardImageUrl}
              onChange={(event) => setFormState((current) => ({ ...current, cardImageUrl: event.target.value }))}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={formState.homepageVisible}
              onChange={(event) =>
                setFormState((current) => ({ ...current, homepageVisible: event.target.checked }))
              }
            />
            Homepage visible
          </label>
          <label>
            <input
              type="checkbox"
              checked={formState.navVisible}
              onChange={(event) =>
                setFormState((current) => ({ ...current, navVisible: event.target.checked }))
              }
            />
            Navigation visible
          </label>
          {status ? <p className="pg-muted-copy">{status}</p> : null}
          <button type="submit" className="pg-primary-button">
            SAVE COLLECTION
          </button>
        </form>
      </div>
    </div>
  );
}

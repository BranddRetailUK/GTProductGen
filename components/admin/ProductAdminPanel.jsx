"use client";

import { useEffect, useState } from "react";

export default function ProductAdminPanel() {
  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [formState, setFormState] = useState({
    title: "",
    description: "",
    status: "published"
  });
  const [status, setStatus] = useState("");

  useEffect(() => {
    void fetchProducts();
  }, []);

  async function fetchProducts() {
    const response = await fetch("/api/admin/products");
    const payload = await response.json();
    const nextProducts = payload?.products || [];
    setProducts(nextProducts);
    if (!selectedId && nextProducts[0]) {
      selectProduct(nextProducts[0]);
    }
  }

  function selectProduct(product) {
    setSelectedId(String(product.id));
    setFormState({
      title: product.title || "",
      description: product.description || "",
      status: product.status || "published"
    });
  }

  async function handleSave(event) {
    event.preventDefault();
    setStatus("");

    const response = await fetch(`/api/admin/products/${selectedId}`, {
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
    setStatus("Product saved.");
    await fetchProducts();
  }

  return (
    <div className="pg-admin-panel">
      <div className="pg-page-head">
        <p className="pg-kicker">Product Admin</p>
        <h2>Edit generated storefront products</h2>
      </div>

      <div className="pg-admin-grid">
        <div className="pg-admin-list">
          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              className={`pg-admin-list-item${String(product.id) === selectedId ? " is-active" : ""}`}
              onClick={() => selectProduct(product)}
            >
              <strong>{product.title}</strong>
              <span>{product.status}</span>
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
            <span>Description</span>
            <textarea
              rows={8}
              value={formState.description}
              onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
            />
          </label>
          <label className="pg-selector-group">
            <span>Status</span>
            <select
              value={formState.status}
              onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="published">published</option>
              <option value="draft">draft</option>
            </select>
          </label>
          {status ? <p className="pg-muted-copy">{status}</p> : null}
          <button type="submit" className="pg-primary-button">
            SAVE PRODUCT
          </button>
        </form>
      </div>
    </div>
  );
}

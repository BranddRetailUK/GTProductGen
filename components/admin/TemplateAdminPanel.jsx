"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const GBP_FORMATTER = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP"
});

function normalizeToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function findBlackBaseAsset(template) {
  const assets = (Array.isArray(template?.viewAssets) ? template.viewAssets : []).filter(
    (asset) =>
      asset?.assetUrl &&
      String(asset?.viewId || "front") === "front" &&
      String(asset?.assetType || "base") === "base"
  );

  return (
    assets.find((asset) => normalizeToken(asset.colourName) === "black") ||
    assets.find((asset) => normalizeToken(asset.colourName).includes("black")) ||
    assets.find((asset) => !asset.colourName) ||
    assets[0] ||
    null
  );
}

function resolveTemplateImageUrl(template) {
  const asset = findBlackBaseAsset(template);
  if (asset?.assetUrl) return asset.assetUrl;

  const fallbackImage = (Array.isArray(template?.images) ? template.images : []).find(
    (image) => image?.imageUrl || image?.src
  );
  return fallbackImage?.imageUrl || fallbackImage?.src || null;
}

function resolveTemplatePrice(template) {
  const variantCosts = (Array.isArray(template?.variants) ? template.variants : [])
    .map((variant) => Number(variant?.costPrice))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (variantCosts.length) return Math.min(...variantCosts);

  const configuredPrice = Number(template?.priceConfig?.defaultPriceGbp);
  if (Number.isFinite(configuredPrice) && configuredPrice > 0) return configuredPrice;

  const variantPrices = (Array.isArray(template?.variants) ? template.variants : [])
    .map((variant) => Number(variant?.price))
    .filter((value) => Number.isFinite(value) && value > 0);
  return variantPrices.length ? Math.min(...variantPrices) : null;
}

function formatTemplatePrice(template) {
  const price = resolveTemplatePrice(template);
  return price == null ? "Cost price unavailable" : `Cost price from ${GBP_FORMATTER.format(price)}`;
}

export default function TemplateAdminPanel() {
  const [templates, setTemplates] = useState([]);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void fetchTemplates();
  }, []);

  async function fetchTemplates() {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/templates", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "templates_load_failed");
      }
      setTemplates(payload?.templates || []);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load templates.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="pg-admin-panel">
      <div className="pg-page-head">
        <p className="pg-kicker">Templates</p>
        <h2>Template products</h2>
      </div>

      {status ? <p className="pg-error-copy">{status}</p> : null}

      {isLoading ? (
        <div className="pg-empty-state">
          <p>Loading templates...</p>
        </div>
      ) : null}
      {!isLoading && !templates.length && !status ? (
        <div className="pg-empty-state">
          <p>No templates found.</p>
        </div>
      ) : null}

      <div className="pg-template-grid">
        {templates.map((template) => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({ template }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = resolveTemplateImageUrl(template);

  return (
    <article className="pg-template-card">
      <div className="pg-template-card-media">
        {imageUrl && !imageFailed ? (
          <img
            src={imageUrl}
            alt={template.title || "Template product"}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span>{template.productType || "Template"}</span>
        )}
      </div>

      <div className="pg-template-card-copy">
        <h3>{template.title}</h3>
        <p>{formatTemplatePrice(template)}</p>
      </div>

      <Link href="/admin/print-areas" className="pg-primary-button pg-template-card-action">
        Edit print area
      </Link>
    </article>
  );
}

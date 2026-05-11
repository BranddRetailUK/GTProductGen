export function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function stripTemplatePrefix(title) {
  return String(title || "")
    .replace(/^template\s*\|\s*/i, "")
    .trim();
}

export function buildProductHandle(designName, templateTitle, suffix = "") {
  const base = `${slugify(designName)}-${slugify(stripTemplatePrefix(templateTitle))}`.replace(
    /-{2,}/g,
    "-"
  );
  return suffix ? `${base}-${suffix}` : base;
}

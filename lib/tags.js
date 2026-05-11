export function normalizeTagToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function uniqueValues(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
}

export function hasTag(tags, token) {
  const normalizedToken = normalizeTagToken(token);
  return (Array.isArray(tags) ? tags : []).some((tag) => normalizeTagToken(tag) === normalizedToken);
}

export function resolveProductTypeTag(template) {
  const values = [
    template?.title,
    template?.productType,
    ...(Array.isArray(template?.tags) ? template.tags : [])
  ]
    .join(" ")
    .toLowerCase();

  if (values.includes("hoodie")) return "Hoodies";
  if (values.includes("sweat") || values.includes("crewneck") || values.includes("sweatshirt")) {
    return "Sweats";
  }
  if (
    values.includes("cap") ||
    values.includes("bag") ||
    values.includes("case") ||
    values.includes("accessor")
  ) {
    return "Accessories";
  }
  return "T-Shirts";
}

export function resolveAudienceTag(template) {
  const values = [
    template?.title,
    ...(Array.isArray(template?.tags) ? template.tags : [])
  ]
    .join(" ")
    .toLowerCase();

  if (values.includes("women") || values.includes("ladies")) return "Womens";
  if (values.includes("kids") || values.includes("youth") || values.includes("junior")) return "Kids";
  return "Mens";
}

export function buildCatalogTags(template) {
  const audienceTag = resolveAudienceTag(template);
  const productTypeTag = resolveProductTypeTag(template);
  return uniqueValues([
    audienceTag,
    productTypeTag,
    ...(Array.isArray(template?.tags) ? template.tags : [])
  ]);
}

export function resolvePlaceholderByProductType(productType) {
  if (productType === "Hoodies" || productType === "Sweats") {
    return "/mock/placeholder-hoodie.svg";
  }
  if (productType === "Accessories") {
    return "/mock/placeholder-accessory.svg";
  }
  return "/mock/placeholder-tee.svg";
}

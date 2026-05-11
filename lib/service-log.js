import { hasDatabase, query } from "./db.js";

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function formatMeta(meta) {
  return Object.entries(meta || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${clean(key)}=${clean(value)}`)
    .join(" ");
}

export async function writeServiceLog(level, message, meta = {}) {
  const safeLevel = clean(level || "info").toLowerCase() || "info";
  const safeMessage = clean(message);
  const suffix = formatMeta(meta);
  const line = suffix ? `${safeMessage} ${suffix}` : safeMessage;

  console[safeLevel === "error" ? "error" : safeLevel === "warn" ? "warn" : "log"](
    `[product-gen] level=${safeLevel} ${line}`
  );

  if (!hasDatabase() || !safeMessage) return;

  try {
    await query(
      `
        INSERT INTO service_logs (service, level, message, source)
        VALUES ($1, $2, $3, $4)
      `,
      ["product-gen", safeLevel, line, meta.source ? clean(meta.source) : null]
    );
  } catch {
    // ignore logging persistence failures
  }
}

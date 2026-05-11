import { readFile } from "node:fs/promises";

import { Pool } from "pg";

import { resolveProductGenPath } from "./paths.js";

const POOL_KEY = Symbol.for("product-gen.pool");
const SCHEMA_KEY = Symbol.for("product-gen.schema-promise");

export function hasDatabase() {
  return Boolean(String(process.env.DATABASE_URL || "").trim());
}

export function getPool() {
  if (!hasDatabase()) return null;
  if (!globalThis[POOL_KEY]) {
    globalThis[POOL_KEY] = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        String(process.env.DATABASE_SSL || "").toLowerCase() === "false"
          ? false
          : { rejectUnauthorized: false }
    });
  }
  return globalThis[POOL_KEY];
}

export async function query(text, params = []) {
  const pool = getPool();
  if (!pool) {
    throw new Error("DATABASE_URL is not configured for product-gen");
  }
  return pool.query(text, params);
}

export async function ensureProductGenSchema() {
  if (!hasDatabase()) return false;
  if (globalThis[SCHEMA_KEY]) return globalThis[SCHEMA_KEY];

  globalThis[SCHEMA_KEY] = (async () => {
    const sql = await readFile(resolveProductGenPath("db/migrations/0001_init.sql"), "utf8");
    await query(sql);
    return true;
  })().catch((error) => {
    delete globalThis[SCHEMA_KEY];
    throw error;
  });

  return globalThis[SCHEMA_KEY];
}

export async function loadStateValue(key) {
  await ensureProductGenSchema();
  const result = await query(`SELECT value FROM product_gen_state WHERE key = $1`, [key]);
  return result.rows[0]?.value ?? null;
}

export async function saveStateValue(key, value) {
  await ensureProductGenSchema();
  await query(
    `
      INSERT INTO product_gen_state (key, value, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
    [key, JSON.stringify(value)]
  );
}

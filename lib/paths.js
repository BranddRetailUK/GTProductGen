import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function getProductGenRoot() {
  return ROOT_DIR;
}

export function resolveProductGenPath(...segments) {
  return path.join(ROOT_DIR, ...segments);
}

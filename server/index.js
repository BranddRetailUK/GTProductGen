import "dotenv/config";

import http from "node:http";
import { fileURLToPath } from "node:url";

import next from "next";

import { startProductGenRuntime } from "./runtime.js";
import { writeServiceLog } from "../lib/service-log.js";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT || 3000);
const dir = fileURLToPath(new URL("..", import.meta.url));
const app = next({ dev, dir });
const handle = app.getRequestHandler();

await app.prepare();
await startProductGenRuntime();

http
  .createServer((req, res) => handle(req, res))
  .listen(port, async () => {
    await writeServiceLog("info", "server_listening", {
      port,
      mode: dev ? "development" : "production"
    });
  });

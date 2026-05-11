import PgBoss from "pg-boss";

import { hasDatabase } from "../lib/db.js";
import { processGenerationRun } from "../lib/generation.js";
import { rescanDesignLibrary } from "../lib/catalog.js";
import { getServiceState } from "../lib/store.js";
import { writeServiceLog } from "../lib/service-log.js";

const RUNTIME_KEY = Symbol.for("product-gen.runtime");

function getRuntimeState() {
  if (!globalThis[RUNTIME_KEY]) {
    globalThis[RUNTIME_KEY] = {
      started: false,
      boss: null,
      scanTimer: null
    };
  }
  return globalThis[RUNTIME_KEY];
}

function getQueueNames() {
  return {
    generation: String(process.env.PRODUCT_GEN_QUEUE_GENERATION || "product-gen:generation-run"),
    dropboxScan: String(process.env.PRODUCT_GEN_QUEUE_DROPBOX_SCAN || "product-gen:dropbox-scan")
  };
}

export async function enqueueGenerationRun(runId) {
  const runtime = getRuntimeState();
  const queues = getQueueNames();

  if (runtime.boss) {
    await runtime.boss.send(queues.generation, { runId });
    return;
  }

  setTimeout(() => {
    void processGenerationRun(runId);
  }, 0);
}

export async function enqueueDropboxScan() {
  const runtime = getRuntimeState();
  const queues = getQueueNames();

  if (runtime.boss) {
    await runtime.boss.send(queues.dropboxScan, { requestedAt: Date.now() });
    return;
  }

  setTimeout(() => {
    void rescanDesignLibrary();
  }, 0);
}

async function startBoss() {
  if (!hasDatabase() || String(process.env.PG_BOSS_ENABLED || "true") === "false") {
    return null;
  }

  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    ssl:
      String(process.env.DATABASE_SSL || "").toLowerCase() === "false"
        ? false
        : { rejectUnauthorized: false }
  });

  await boss.start();

  const queues = getQueueNames();
  await boss.work(queues.generation, async (job) => {
    if (!job?.data?.runId) return;
    await processGenerationRun(job.data.runId);
  });
  await boss.work(queues.dropboxScan, async () => {
    await rescanDesignLibrary();
  });

  return boss;
}

export async function startProductGenRuntime() {
  const runtime = getRuntimeState();
  if (runtime.started) return runtime;

  await getServiceState();
  runtime.started = true;
  runtime.boss = await startBoss().catch(async (error) => {
    await writeServiceLog("warn", "pg_boss_start_failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  });

  const scanIntervalMs = Number(process.env.PRODUCT_GEN_SCAN_INTERVAL_MS || 15 * 60 * 1000);
  runtime.scanTimer = setInterval(() => {
    void enqueueDropboxScan();
  }, scanIntervalMs);

  if (typeof runtime.scanTimer.unref === "function") {
    runtime.scanTimer.unref();
  }

  await writeServiceLog("info", "runtime_started", {
    boss: runtime.boss ? "enabled" : "disabled",
    scanIntervalMs
  });

  return runtime;
}

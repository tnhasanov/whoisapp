/**
 * Research worker entry point: `npm run worker`.
 * Runs alongside the web app (same DATABASE_URL). Stop with SIGTERM/SIGINT;
 * in-flight jobs are handed back to the queue and resumed from checkpoints.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

async function main() {
  const { getEnv } = await import("@/lib/env");
  const { getDb, closeDb } = await import("@/lib/db/client");
  const { ResearchWorker } = await import("./worker");

  const env = getEnv();
  const worker = new ResearchWorker({ db: getDb(), env });
  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`[worker] ${signal} received, finishing in-flight steps…`);
    worker
      .stop()
      .then(() => closeDb())
      .then(() => process.exit(0))
      .catch((error) => {
        console.error("[worker] shutdown error", error);
        process.exit(1);
      });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  await worker.start();
}

main().catch((error) => {
  console.error("[worker] fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});

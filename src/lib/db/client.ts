import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

type DbGlobal = { pool?: Pool; db?: Database; url?: string };
const globalForDb = globalThis as unknown as { __personbriefDb?: DbGlobal };

/**
 * Lazily-created shared pool. Reused across hot reloads in development and
 * across requests in production. The worker process creates its own pool.
 */
export function getDb(): Database {
  const state = (globalForDb.__personbriefDb ??= {});
  const url = getEnv().DATABASE_URL;
  if (state.db && state.url === url) return state.db;
  state.pool = new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  state.pool.on("error", (err) => {
    // Idle client errors must not crash the process; log without connection details.
    console.error("[db] idle client error:", err.message);
  });
  state.db = drizzle(state.pool, { schema });
  state.url = url;
  return state.db;
}

export async function closeDb() {
  const state = globalForDb.__personbriefDb;
  if (state?.pool) {
    await state.pool.end();
    state.pool = undefined;
    state.db = undefined;
  }
}

export { schema };

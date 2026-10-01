import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { ownerSettings, users } from "@/lib/db/schema";
import type { UserRole, Workspace } from "@/lib/domain/types";
import { getEnv, resetEnvCache } from "@/lib/env";
import type { Actor } from "@/lib/research/service";
import { ResearchWorker } from "@/worker/worker";

export function db() {
  return getDb();
}

export function env() {
  resetEnvCache();
  return getEnv();
}

const TABLES = [
  "usage_records",
  "provider_cache",
  "export_log",
  "issue_reports",
  "profile_tags",
  "tags",
  "notes",
  "media_items",
  "media_story_groups",
  "relationship_sources",
  "relationships",
  "organisations",
  "social_accounts",
  "contacts",
  "claim_sources",
  "claims",
  "sources",
  "snapshots",
  "profiles",
  "candidate_identities",
  "job_documents",
  "job_events",
  "job_steps",
  "research_jobs",
  "app_rate_limits",
  "worker_heartbeats",
  "owner_settings",
  "auth_sessions",
  "auth_accounts",
  "auth_verifications",
  "auth_rate_limits",
  "auth_users",
];

export async function resetDb() {
  await getDb().execute(sql.raw(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`));
}

export async function createUser(role: UserRole, workspace: Workspace = role === "owner" ? "live" : "demo"): Promise<Actor> {
  const id = randomUUID();
  await getDb().insert(users).values({ id, name: role === "owner" ? "Owner" : "Guest", email: `${id}@test.invalid`, role, emailVerified: true, isAnonymous: role !== "owner" });
  await getDb().insert(ownerSettings).values({ userId: id, activeWorkspace: workspace });
  return { userId: id, role, workspace };
}

export function makeWorker(overrides: Partial<ConstructorParameters<typeof ResearchWorker>[0]> = {}) {
  return new ResearchWorker({ db: getDb(), env: env(), leaseSeconds: 30, pollMs: 50, log: () => undefined, ...overrides });
}

export function idem() {
  return randomUUID().replace(/-/g, "");
}

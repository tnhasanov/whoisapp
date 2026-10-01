import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium, type FullConfig } from "@playwright/test";
import { Pool } from "pg";
import { OWNER, OWNER_STATE } from "./support";

/**
 * Creates the e2e owner (once) in the database the server under test uses and
 * stores a signed-in session, so tests do not hit the sign-in rate limits.
 */
/** Research data from earlier runs is cleared so every run starts from the same state (accounts are kept). */
const RESEARCH_TABLES = [
  "usage_records", "provider_cache", "export_log", "issue_reports", "profile_tags", "tags", "notes", "media_items", "media_story_groups",
  "relationship_sources", "relationships", "organisations", "social_accounts", "contacts", "claim_sources", "claims", "sources", "snapshots",
  "profiles", "candidate_identities", "job_documents", "job_events", "job_steps", "research_jobs", "app_rate_limits",
];

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  if (process.env.E2E_DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.E2E_DATABASE_URL, max: 1 });
    try {
      await pool.query(`TRUNCATE ${RESEARCH_TABLES.join(", ")} RESTART IDENTITY CASCADE`);
      await pool.query(`DELETE FROM auth_users WHERE role = 'demo'`);
      await pool.query(`UPDATE owner_settings SET active_workspace = 'live', locale = 'en', timezone = 'Asia/Baku'`);
    } finally {
      await pool.end();
    }
    try {
      execFileSync("npx", ["tsx", "scripts/create-owner.ts", "--email", OWNER.email, "--name", OWNER.name], {
        env: { ...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL, OWNER_PASSWORD: OWNER.password },
        stdio: "pipe",
      });
    } catch (error) {
      const output = String((error as { stderr?: Buffer }).stderr ?? "");
      if (!/already exists/i.test(output)) throw new Error(`Could not create the e2e owner: ${output}`);
    }
  }
  mkdirSync("tests/e2e/.auth", { recursive: true });
  const browser = await chromium.launch(config.projects[0].use.launchOptions);
  const page = await browser.newPage({ baseURL });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await Promise.all([page.waitForURL(/\/search/), page.getByRole("button", { name: "Sign in" }).click()]);
  await page.context().storageState({ path: OWNER_STATE });
  await browser.close();
}

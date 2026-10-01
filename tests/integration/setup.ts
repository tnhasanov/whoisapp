import { config } from "dotenv";

// Next's env loader ignores .env.local when NODE_ENV=test, so load it explicitly.
config({ path: [".env.test.local", ".env.local", ".env"], quiet: true });

// Integration tests always run against the dedicated test database.
if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL must be set for integration tests.");
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-123456";
process.env.APP_URL ??= "http://localhost:3000";
process.env.FIXTURE_LATENCY_MS = "0";
process.env.RESEARCH_PROVIDER_MAX_RETRIES = "1";
// Live provider keys are never used by tests.
delete process.env.TAVILY_API_KEY;
delete process.env.ANTHROPIC_API_KEY;

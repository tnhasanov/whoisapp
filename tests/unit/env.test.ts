import { afterEach, describe, expect, it } from "vitest";
import { getEnv, resetEnvCache, setupTokenStatus } from "@/lib/env";

const BASE = { DATABASE_URL: "postgres://u:p@localhost:5432/db", BETTER_AUTH_SECRET: "x".repeat(40) };
const saved = { ...process.env };

function withEnv(vars: Record<string, string | undefined>) {
  for (const key of ["APP_URL", "RENDER_EXTERNAL_URL", "OWNER_SETUP_TOKEN"]) delete process.env[key];
  Object.assign(process.env, BASE);
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetEnvCache();
  return getEnv();
}

afterEach(() => {
  process.env = { ...saved };
  resetEnvCache();
});

describe("server environment", () => {
  it("uses the hosting platform's public URL when APP_URL is not set", () => {
    expect(withEnv({ RENDER_EXTERNAL_URL: "https://personbrief.onrender.com" }).APP_URL).toBe("https://personbrief.onrender.com");
    expect(withEnv({ RENDER_EXTERNAL_URL: "https://personbrief.onrender.com", APP_URL: "https://brief.example.com" }).APP_URL).toBe("https://brief.example.com");
    expect(withEnv({}).APP_URL).toBe("http://localhost:3000");
  });

  it("never fails to start because the setup token is short; it only disables setup", () => {
    expect(setupTokenStatus(withEnv({ OWNER_SETUP_TOKEN: "short" }))).toBe("too_short");
    expect(setupTokenStatus(withEnv({ OWNER_SETUP_TOKEN: "  " }))).toBe("missing");
    expect(setupTokenStatus(withEnv({}))).toBe("missing");
    expect(setupTokenStatus(withEnv({ OWNER_SETUP_TOKEN: "a long phrase only I know" }))).toBe("ok");
  });
});

/**
 * The app's own auth client (Better Auth + Expo plugin, cookie in the
 * keychain mock) and API client against a running PersonBrief server in the
 * fictional demo workspace. Run with:
 *
 *   PB_TEST_API_URL=http://localhost:3100 PB_TEST_EMAIL=… PB_TEST_PASSWORD=… npm run test:api
 *
 * The server must run in production mode (next start), so this also checks
 * that the release URL scheme is trusted and nothing else.
 */
import {
  JobDetailSchema,
  MeResponseSchema,
  NoteSchema,
  ProfileDetailSchema,
  SessionListResponseSchema,
  StartResearchResponseSchema,
} from "@personbrief/shared/api/v1";
import { secureStore } from "../native-mocks";

const BASE = process.env.PB_TEST_API_URL;
const EMAIL = process.env.PB_TEST_EMAIL ?? "";
const PASSWORD = process.env.PB_TEST_PASSWORD ?? "";
const live = BASE ? describe : describe.skip;

jest.mock("../../src/lib/config", () => {
  const actual = jest.requireActual("../../src/lib/config");
  return { ...actual, API_CONFIG: { ok: true, baseUrl: process.env.PB_TEST_API_URL ?? "http://localhost:3100", source: "build" }, APP_SCHEME: "personbrief" };
});

type Keychain = Map<string, string>;
const snapshot = (): Keychain => new Map(secureStore);
const restore = (k: Keychain) => {
  secureStore.clear();
  for (const [key, value] of k) secureStore.set(key, value);
};

function load() {
  return {
    auth: require("../../src/lib/auth-client") as typeof import("../../src/lib/auth-client"),
    api: require("../../src/lib/api") as typeof import("../../src/lib/api"),
  };
}

async function signInDevice(): Promise<Keychain> {
  secureStore.clear();
  let keychain: Keychain = new Map();
  await jest.isolateModulesAsync(async () => {
    const { auth } = load();
    const result = await auth.getAuthClient().signIn.email({ email: EMAIL, password: PASSWORD, rememberMe: true });
    expect(result.error).toBeNull();
    keychain = snapshot();
  });
  return keychain;
}

async function waitFor<T>(fn: () => Promise<T>, done: (value: T) => boolean, timeoutMs = 90_000): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (done(value) || Date.now() > until) return value;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

live("the app against a running server", () => {
  it("keeps the session in the keychain across restarts and stops at sign-out", async () => {
    const keychain = await signInDevice();
    expect(keychain.get("personbrief_cookie")).toMatch(/session_token/);
    // Nothing but the cookie (and the plugin's empty cache marker) is stored on the device.
    expect([...keychain.keys()].every((k) => k.startsWith("personbrief_"))).toBe(true);
    expect([...keychain.values()].join(" ")).not.toContain(PASSWORD);

    // "Restart": fresh modules, same keychain.
    restore(keychain);
    await jest.isolateModulesAsync(async () => {
      const { api } = load();
      const me = await api.request("/me", { schema: MeResponseSchema });
      expect(me.user.email).toBe(EMAIL);
      const sessions = await api.request("/sessions", { schema: SessionListResponseSchema });
      expect(sessions.items.find((s) => s.current)?.device).toBe("app_ios");
    });

    // Sign-out revokes the session on the server and clears the keychain.
    const rawCookie = (() => {
      const stored = JSON.parse(keychain.get("personbrief_cookie")!) as Record<string, { value: string }>;
      return Object.entries(stored).map(([k, v]) => `${k}=${v.value}`).join("; ");
    })();
    await jest.isolateModulesAsync(async () => {
      const { auth, api } = load();
      await auth.getAuthClient().signOut();
      expect(await auth.sessionCookie()).toBe("");
      await expect(api.request("/me", { quietUnauthorized: true })).rejects.toMatchObject({ status: 401 });
    });
    const replay = await fetch(`${BASE}/api/v1/me`, { headers: { cookie: rawCookie } });
    expect(replay.status).toBe(401);
  });

  it("signs a phone out when its session is revoked from another device", async () => {
    const phone = await signInDevice();
    const laptop = await signInDevice();
    restore(laptop);
    await jest.isolateModulesAsync(async () => {
      const { api } = load();
      const list = await api.request("/sessions", { schema: SessionListResponseSchema });
      const phoneSession = list.items.find((s) => !s.current)!;
      await api.request(`/sessions/${phoneSession.id}`, { method: "DELETE" });
    });
    restore(phone);
    await jest.isolateModulesAsync(async () => {
      const { api } = load();
      const lost = jest.fn();
      api.onUnauthorized(lost);
      await expect(api.request("/me")).rejects.toMatchObject({ code: "unauthenticated" });
      expect(lost).toHaveBeenCalledTimes(1);
    });
    restore(laptop);
    await jest.isolateModulesAsync(async () => {
      await load().auth.getAuthClient().signOut();
    });
  });

  it("runs search → choose → research → brief → save → notes → export, shared across devices", async () => {
    const phone = await signInDevice();
    const tablet = await signInDevice();
    restore(phone);
    await jest.isolateModulesAsync(async () => {
      const { api } = load();
      await api.request("/me/workspace", { method: "PUT", body: { workspace: "demo" }, schema: MeResponseSchema });

      // A dropped connection after the server accepted the request: the retry reuses the key.
      const key = `apitest${Date.now()}`;
      const lostResponse = await fetch(api.apiUrl("/research"), {
        method: "POST",
        headers: { ...(await api.authHeaders()), "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ fullName: "Tural Mammadov" }),
      });
      expect(lostResponse.status).toBe(201);
      const retried = await api.request("/research", { method: "POST", body: { fullName: "Tural Mammadov" }, idempotencyKey: key, schema: StartResearchResponseSchema });
      expect(retried.created).toBe(false);
      const jobId = retried.job.id;

      // Several people share the name: the owner chooses one.
      const waiting = await waitFor(
        () => api.request(`/research/${jobId}`, { schema: JobDetailSchema }),
        (j) => j.status === "awaiting_identity",
      );
      expect(waiting.candidates.length).toBeGreaterThanOrEqual(2);
      await api.request(`/research/${jobId}/select`, { method: "POST", body: { candidateId: waiting.candidates[1].id }, schema: JobDetailSchema });
      const done = await waitFor(
        () => api.request(`/research/${jobId}`, { schema: JobDetailSchema }),
        (j) => j.status === "completed" || j.status === "failed" || j.status === "partial",
      );
      expect(done.status).toBe("completed");
      expect(done.pollAfterMs).toBeNull();

      const brief = await api.request(`/profiles/${done.profileId}`, { schema: ProfileDetailSchema });
      expect(brief.profile.workspace).toBe("demo");
      expect(brief.snapshot.model.provider).toBe("fixture");
      await api.request(`/profiles/${done.profileId}/saved`, { method: "PUT", body: { saved: true } });
      const note = await api.request(`/profiles/${done.profileId}/notes`, { method: "POST", body: { body: "Seen from the phone" }, schema: NoteSchema });

      // Authenticated PDF download (what the share sheet receives).
      const pdf = await fetch(api.apiUrl(`/profiles/${done.profileId}/export`, { format: "pdf" }), { headers: await api.authHeaders() });
      expect(pdf.status).toBe(200);
      expect(pdf.headers.get("content-type")).toBe("application/pdf");
      expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
      const json = await fetch(api.apiUrl(`/profiles/${done.profileId}/export`, { format: "json" }), { headers: await api.authHeaders() });
      expect(await json.text()).not.toContain("Seen from the phone");

      // The other device (its own keychain; the client reads the cookie on every request)
      // sees the same saved work and note, and deletes the note.
      restore(tablet);
      const seen = await api.request(`/profiles/${done.profileId}`, { schema: ProfileDetailSchema });
      expect(seen.profile.savedAt).not.toBeNull();
      expect(seen.notes.map((n) => n.body)).toContain("Seen from the phone");
      await api.request(`/profiles/${done.profileId}/notes/${note.id}`, { method: "DELETE" });
      restore(phone);
      const after = await api.request(`/profiles/${done.profileId}`, { schema: ProfileDetailSchema });
      expect(after.notes.find((n) => n.id === note.id)).toBeUndefined();

      // Deleting the profile removes it for every device.
      await api.request(`/profiles/${done.profileId}`, { method: "DELETE" });
      await expect(api.request(`/profiles/${done.profileId}`)).rejects.toMatchObject({ code: "not_found" });
    });
    for (const device of [phone, tablet]) {
      restore(device);
      await jest.isolateModulesAsync(async () => {
        await load().auth.getAuthClient().signOut();
      });
    }
  });
});

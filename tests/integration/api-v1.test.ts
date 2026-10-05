import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

// next-intl's server helpers need the React Server Components runtime; the PDF
// export only needs plain translators, built here from the same catalogues.
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { readFileSync } = await import("node:fs");
  return {
    getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
      createTranslator({ locale, messages: JSON.parse(readFileSync(`messages/${locale}.json`, "utf8")), namespace: namespace as never }),
  };
});
import * as meta from "@/app/api/v1/meta/route";
import * as me from "@/app/api/v1/me/route";
import * as preferences from "@/app/api/v1/me/preferences/route";
import * as workspace from "@/app/api/v1/me/workspace/route";
import * as settings from "@/app/api/v1/settings/route";
import * as sessionsRoute from "@/app/api/v1/sessions/route";
import * as sessionRoute from "@/app/api/v1/sessions/[sessionId]/route";
import * as research from "@/app/api/v1/research/route";
import * as recent from "@/app/api/v1/research/recent/route";
import * as job from "@/app/api/v1/research/[jobId]/route";
import * as select from "@/app/api/v1/research/[jobId]/select/route";
import * as refine from "@/app/api/v1/research/[jobId]/refine/route";
import * as cancel from "@/app/api/v1/research/[jobId]/cancel/route";
import * as retry from "@/app/api/v1/research/[jobId]/retry/route";
import * as examples from "@/app/api/v1/examples/route";
import * as demoSource from "@/app/api/v1/demo-sources/[key]/route";
import * as profilesRoute from "@/app/api/v1/profiles/route";
import * as profile from "@/app/api/v1/profiles/[profileId]/route";
import * as saved from "@/app/api/v1/profiles/[profileId]/saved/route";
import * as refresh from "@/app/api/v1/profiles/[profileId]/refresh/route";
import * as changes from "@/app/api/v1/profiles/[profileId]/changes/route";
import * as notesRoute from "@/app/api/v1/profiles/[profileId]/notes/route";
import * as noteRoute from "@/app/api/v1/profiles/[profileId]/notes/[noteId]/route";
import * as tagsRoute from "@/app/api/v1/profiles/[profileId]/tags/route";
import * as tagRoute from "@/app/api/v1/profiles/[profileId]/tags/[tagId]/route";
import * as issues from "@/app/api/v1/profiles/[profileId]/issues/route";
import * as exportRoute from "@/app/api/v1/profiles/[profileId]/export/route";
import * as allTags from "@/app/api/v1/tags/route";
import * as device from "@/app/api/v1/devices/current/route";
import { pushDeliveries, pushDevices, sessions } from "@/lib/db/schema";
import { dispatchPushNotifications, type ExpoMessage, type PushTransport } from "@/lib/push/dispatch";
import {
  ApiErrorBodySchema,
  ChangesResponseSchema,
  DemoSourceSchema,
  DeviceResponseSchema,
  ExamplesResponseSchema,
  JobDetailSchema,
  JobListResponseSchema,
  MeResponseSchema,
  MetaResponseSchema,
  NoteSchema,
  ProfileDetailSchema,
  ProfileListResponseSchema,
  ProfileTagsResponseSchema,
  RecentSearchesResponseSchema,
  SessionListResponseSchema,
  SettingsResponseSchema,
  StartResearchResponseSchema,
} from "@personbrief/shared/api/v1";
import { authCall, body, call, createPasswordUser, signIn } from "./api-helpers";
import { db, idem, makeWorker, resetDb } from "./helpers";

const RICH = { fullName: "Elnara Gasimova", company: "Caspian Lantern Analytics" };

async function owner() {
  const user = await createPasswordUser("owner", "owner@personbrief.test");
  const { response, cookie } = await signIn(user.email);
  expect(response.status).toBe(200);
  return { ...user, cookie };
}

async function otherAccount() {
  const user = await createPasswordUser("demo", "other@personbrief.test");
  const { cookie } = await signIn(user.email);
  return { ...user, cookie };
}

async function startAndFinish(cookie: string, input: Record<string, unknown> = RICH) {
  const started = await call(research.POST, "/research", { method: "POST", cookie, body: input, headers: { "Idempotency-Key": idem() } });
  expect(started.status).toBe(201);
  const { job: created } = StartResearchResponseSchema.parse(await body(started));
  await makeWorker().drain();
  const done = JobDetailSchema.parse(await body(await call(job.GET, `/research/${created.id}`, { cookie, params: { jobId: created.id } })));
  return done;
}

describe("/api/v1 — authentication for the mobile app", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("signs in with the app's origin, stores a cookie session and answers /me", async () => {
    const { cookie } = await owner();
    expect(cookie).toMatch(/^personbrief\.session_token=/);
    const res = await call(me.GET, "/me", { cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const data = MeResponseSchema.parse(await body(res));
    expect(data.user).toMatchObject({ role: "owner", isGuest: false, email: "owner@personbrief.test" });
    expect(data.preferences).toEqual({ locale: "en", timezone: "Asia/Baku" });
    expect(data.capabilities.canSwitchWorkspace).toBe(true);
    // A restarted app sends the same stored cookie and keeps its session.
    expect((await call(me.GET, "/me", { cookie })).status).toBe(200);
    // The session list recognises the app.
    const list = SessionListResponseSchema.parse(await body(await call(sessionsRoute.GET, "/sessions", { cookie })));
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ current: true, device: "app_ios" });
  });

  it("rejects wrong passwords, untrusted origins and every auth endpoint that is not needed", async () => {
    await createPasswordUser("owner", "owner@personbrief.test");
    const wrong = await signIn("owner@personbrief.test", "not-the-password");
    expect(wrong.response.status).toBe(401);
    expect(wrong.cookie).toBe("");

    const { cookie } = await signIn("owner@personbrief.test");
    // Cookie-authenticated auth requests from an unknown origin are refused (CSRF protection).
    const evil = await authCall("/sign-out", { method: "POST", cookie, headers: { "expo-origin": "evil-app://" }, body: {} });
    expect(evil.status).toBe(403);
    expect((await call(me.GET, "/me", { cookie })).status).toBe(200);

    // Closed registration and no account management over HTTP.
    for (const path of ["/sign-up/email", "/update-user", "/change-password", "/list-sessions", "/revoke-sessions", "/request-password-reset", "/delete-user"]) {
      const res = await authCall(path, { method: "POST", body: { email: "x@y.z", password: "long-enough-password", name: "X" } });
      expect(res.status, path).toBe(404);
    }
    const anon = await authCall("/sign-in/anonymous", { method: "POST", body: {} });
    if (process.env.PUBLIC_DEMO_ENABLED !== "true") expect(anon.status).toBe(404);
  });

  it("treats missing, expired, revoked and signed-out sessions as unauthenticated", async () => {
    const res = await call(me.GET, "/me");
    expect(res.status).toBe(401);
    expect(ApiErrorBodySchema.parse(await body(res)).error.code).toBe("unauthenticated");

    const { cookie } = await owner();
    // Expiry.
    await db().execute(sql`UPDATE auth_sessions SET expires_at = now() - interval '1 minute'`);
    expect((await call(me.GET, "/me", { cookie })).status).toBe(401);

    // Revocation from another device.
    const phone = await signIn("owner@personbrief.test");
    const laptop = await signIn("owner@personbrief.test");
    const list = SessionListResponseSchema.parse(await body(await call(sessionsRoute.GET, "/sessions", { cookie: laptop.cookie })));
    const phoneSession = list.items.find((s) => !s.current)!;
    expect((await call(sessionRoute.DELETE, `/sessions/${phoneSession.id}`, { method: "DELETE", cookie: laptop.cookie, params: { sessionId: phoneSession.id } })).status).toBe(204);
    expect((await call(me.GET, "/me", { cookie: phone.cookie })).status).toBe(401);
    expect((await call(me.GET, "/me", { cookie: laptop.cookie })).status).toBe(200);

    // Sign-out revokes the session on the server.
    const out = await authCall("/sign-out", { method: "POST", cookie: laptop.cookie, body: {} });
    expect(out.status).toBe(200);
    expect((await call(me.GET, "/me", { cookie: laptop.cookie })).status).toBe(401);
    const active = await db().execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM auth_sessions WHERE expires_at > now()`);
    expect(active.rows[0].n).toBe(0);
  });

  it("serves public metadata without a session", async () => {
    const data = MetaResponseSchema.parse(await body(await meta.GET(new Request("http://localhost:3000/api/v1/meta"))));
    expect(data.api.version).toBe(1);
    expect(data.features).toHaveProperty("pushNotifications");
    // Very old builds are told to update.
    const old = await me.GET(new Request("http://localhost:3000/api/v1/me", { headers: { "X-PersonBrief-Client": "ios/0.0.1/0" } }), { params: Promise.resolve({}) });
    expect(old.status).toBe(426);
  });
});

describe("/api/v1 — research, saved work and exports", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("runs the full journey: search → research → brief → save → notes/tags → export → refresh → changes → delete", async () => {
    const { cookie } = await owner();
    MeResponseSchema.parse(await body(await call(workspace.PUT, "/me/workspace", { method: "PUT", cookie, body: { workspace: "demo" } })));

    // Validation uses the shared field codes.
    const invalid = await call(research.POST, "/research", { method: "POST", cookie, body: { fullName: " " }, headers: { "Idempotency-Key": idem() } });
    expect(invalid.status).toBe(400);
    expect(ApiErrorBodySchema.parse(await body(invalid)).error).toMatchObject({ code: "invalid_input", fieldErrors: { fullName: "name_required" } });
    const noKey = await call(research.POST, "/research", { method: "POST", cookie, body: RICH });
    expect(ApiErrorBodySchema.parse(await body(noKey)).error.code).toBe("idempotency_key_required");

    // A repeated submission (double tap, retry after a dropped connection) returns the same run.
    const key = idem();
    const first = StartResearchResponseSchema.parse(await body(await call(research.POST, "/research", { method: "POST", cookie, body: RICH, headers: { "Idempotency-Key": key } })));
    const again = await call(research.POST, "/research", { method: "POST", cookie, body: RICH, headers: { "Idempotency-Key": key } });
    expect(again.status).toBe(200);
    const second = StartResearchResponseSchema.parse(await body(again));
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.job.id).toBe(first.job.id);
    expect(first.job.status).toBe("queued");
    expect(first.job.pollAfterMs).toBeGreaterThan(0);

    await makeWorker().drain();
    const done = JobDetailSchema.parse(await body(await call(job.GET, `/research/${first.job.id}`, { cookie, params: { jobId: first.job.id } })));
    expect(done.status).toBe("completed");
    expect(done.pollAfterMs).toBeNull();
    expect(done.stages.find((s) => s.stage === "persist")?.status).toBe("completed");
    const profileId = done.profileId!;

    const history = JobListResponseSchema.parse(await body(await call(research.GET, "/research", { cookie })));
    expect(history.items.map((j) => j.id)).toEqual([first.job.id]);
    const recentSearches = RecentSearchesResponseSchema.parse(await body(await call(recent.GET, "/research/recent", { cookie })));
    expect(recentSearches.items[0]).toMatchObject({ fullName: RICH.fullName, profileId });

    // The brief.
    const detail = ProfileDetailSchema.parse(await body(await call(profile.GET, `/profiles/${profileId}`, { cookie, params: { profileId } })));
    expect(detail.profile.workspace).toBe("demo");
    expect(detail.snapshot.model.provider).toBe("fixture");
    expect(detail.claims.length).toBeGreaterThan(3);
    expect(detail.claims.every((c) => c.evidence.every((e) => detail.sources.some((s) => s.id === e.sourceId)))).toBe(true);
    expect(detail.sources.every((s) => s.fixtureKey)).toBe(true);
    expect(detail.contacts.some((c) => c.contactType === "switchboard" && !c.isDirect) || detail.contacts.every((c) => c.contactType !== "switchboard")).toBe(true);
    expect(JSON.stringify(detail)).not.toMatch(/owner_id|ownerId|canonicalUrl|diagnostics/);

    // Saved work with notes and tags, shared with the website's data layer.
    expect(await body(await call(saved.PUT, "", { method: "PUT", cookie, body: { saved: true }, params: { profileId } }))).toMatchObject({ savedAt: expect.any(String) });
    const note = NoteSchema.parse(await body(await call(notesRoute.POST, "", { method: "POST", cookie, body: { body: "Private: met at the 2025 forum." }, params: { profileId } })));
    const edited = NoteSchema.parse(await body(await call(noteRoute.PATCH, "", { method: "PATCH", cookie, body: { body: "Private: met twice." }, params: { profileId, noteId: note.id } })));
    expect(edited.body).toBe("Private: met twice.");
    const emptyNote = await call(notesRoute.POST, "", { method: "POST", cookie, body: { body: "   " }, params: { profileId } });
    expect(ApiErrorBodySchema.parse(await body(emptyNote)).error.fieldErrors).toEqual({ body: "note_empty" });
    const tagged = ProfileTagsResponseSchema.parse(await body(await call(tagsRoute.POST, "", { method: "POST", cookie, body: { name: "Baku forum" }, params: { profileId } })));
    expect(tagged.tags.map((t) => t.name)).toEqual(["Baku forum"]);
    expect((await body<{ items: unknown[] }>(await call(allTags.GET, "/tags", { cookie }))).items).toHaveLength(1);

    const savedList = ProfileListResponseSchema.parse(await body(await call(profilesRoute.GET, "/profiles?scope=saved&q=twice", { cookie })));
    expect(savedList.items.map((p) => p.id)).toEqual([profileId]);
    expect(savedList.items[0].tags.map((t) => t.name)).toEqual(["Baku forum"]);

    // Exports: owner-only, notes excluded by default.
    const pdf = await call(exportRoute.GET, "?format=pdf", { cookie, params: { profileId } });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(pdf.headers.get("content-disposition")).toContain("personbrief-DEMO-");
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
    const jsonExport = await call(exportRoute.GET, "?format=json", { cookie, params: { profileId } });
    expect(await jsonExport.text()).not.toContain("Private: met twice.");
    const withNotes = await call(exportRoute.GET, "?format=json&notes=1", { cookie, params: { profileId } });
    expect(await withNotes.text()).toContain("Private: met twice.");
    expect((await call(exportRoute.GET, "?format=docx", { cookie, params: { profileId } })).status).toBe(400);

    // Report an issue.
    expect((await call(issues.POST, "", { method: "POST", cookie, body: { category: "outdated", message: "Role changed in 2026.", claimId: detail.claims[0].id, snapshotId: detail.snapshot.id }, params: { profileId } })).status).toBe(201);

    // Refresh creates a second version; "What changed?" compares them.
    const refreshKey = idem();
    const refreshed = await body<{ jobId: string }>(await call(refresh.POST, "", { method: "POST", cookie, headers: { "Idempotency-Key": refreshKey }, params: { profileId } }));
    const refreshedAgain = await body<{ jobId: string }>(await call(refresh.POST, "", { method: "POST", cookie, headers: { "Idempotency-Key": refreshKey }, params: { profileId } }));
    expect(refreshedAgain.jobId).toBe(refreshed.jobId);
    await makeWorker().drain();
    const diff = ChangesResponseSchema.parse(await body(await call(changes.GET, "", { cookie, params: { profileId } })));
    expect(diff.snapshots).toHaveLength(2);
    expect(diff.diff).not.toBeNull();
    const older = ProfileDetailSchema.parse(await body(await call(profile.GET, `?snapshot=${diff.fromSnapshotId}`, { cookie, params: { profileId } })));
    expect(older.snapshot.version).toBe(1);

    // Removing the tag and the note, then the profile.
    const untagged = ProfileTagsResponseSchema.parse(await body(await call(tagRoute.DELETE, "", { method: "DELETE", cookie, params: { profileId, tagId: tagged.tags[0].id } })));
    expect(untagged.tags).toEqual([]);
    expect((await call(noteRoute.DELETE, "", { method: "DELETE", cookie, params: { profileId, noteId: note.id } })).status).toBe(204);
    expect((await call(profile.DELETE, "", { method: "DELETE", cookie, params: { profileId } })).status).toBe(204);
    expect((await call(profile.GET, "", { cookie, params: { profileId } })).status).toBe(404);
    expect(ProfileListResponseSchema.parse(await body(await call(profilesRoute.GET, "/profiles?scope=all", { cookie }))).items).toEqual([]);
  });

  it("asks the owner to choose between same-name people, supports refine, cancel and idempotent retry", async () => {
    const { cookie } = await owner();
    await call(workspace.PUT, "/me/workspace", { method: "PUT", cookie, body: { workspace: "demo" } });
    const waiting = await startAndFinish(cookie, { fullName: "Tural Mammadov" });
    expect(waiting.status).toBe("awaiting_identity");
    expect(waiting.candidates.length).toBeGreaterThanOrEqual(2);
    expect(new Set(waiting.candidates.map((c) => c.organisation)).size).toBe(waiting.candidates.length);
    const choice = waiting.candidates[0];
    const chosen = JobDetailSchema.parse(await body(await call(select.POST, "", { method: "POST", cookie, body: { candidateId: choice.id }, params: { jobId: waiting.id } })));
    expect(chosen.status).toBe("queued");
    // A second tap on the same candidate is harmless.
    expect((await call(select.POST, "", { method: "POST", cookie, body: { candidateId: choice.id }, params: { jobId: waiting.id } })).status).toBe(200);
    await makeWorker().drain();
    const finished = JobDetailSchema.parse(await body(await call(job.GET, "", { cookie, params: { jobId: waiting.id } })));
    expect(finished.status).toBe("completed");

    // "None of these" closes the choice and returns the query.
    const again = await startAndFinish(cookie, { fullName: "Tural Mammadov" });
    const refined = await body<{ query: { fullName: string } }>(await call(refine.POST, "", { method: "POST", cookie, params: { jobId: again.id } }));
    expect(refined.query.fullName).toBe("Tural Mammadov");
    const closed = JobDetailSchema.parse(await body(await call(job.GET, "", { cookie, params: { jobId: again.id } })));
    expect(closed).toMatchObject({ status: "cancelled", outcome: "refined" });

    // Cancel before the worker picks it up, then retry with one Idempotency-Key.
    const started = StartResearchResponseSchema.parse(await body(await call(research.POST, "/research", { method: "POST", cookie, body: { fullName: "Sevinj Abbasli" }, headers: { "Idempotency-Key": idem() } })));
    const cancelled = JobDetailSchema.parse(await body(await call(cancel.POST, "", { method: "POST", cookie, params: { jobId: started.job.id } })));
    expect(cancelled.status).toBe("cancelled");
    expect((await call(job.DELETE, "", { method: "DELETE", cookie, params: { jobId: waiting.id } })).status).toBe(204);
    const retryKey = idem();
    const retried = await body<{ jobId: string }>(await call(retry.POST, "", { method: "POST", cookie, headers: { "Idempotency-Key": retryKey }, params: { jobId: started.job.id } }));
    const retriedAgain = await body<{ jobId: string }>(await call(retry.POST, "", { method: "POST", cookie, headers: { "Idempotency-Key": retryKey }, params: { jobId: started.job.id } }));
    expect(retriedAgain.jobId).toBe(retried.jobId);
    // Running research cannot be deleted.
    expect((await call(job.DELETE, "", { method: "DELETE", cookie, params: { jobId: retried.jobId } })).status).toBe(409);
    const page = JobListResponseSchema.parse(await body(await call(research.GET, "/research?limit=2", { cookie })));
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).not.toBeNull();
    const rest = JobListResponseSchema.parse(await body(await call(research.GET, `/research?limit=2&cursor=${page.nextCursor}`, { cookie })));
    expect(new Set([...page.items, ...rest.items].map((j) => j.id)).size).toBe(page.items.length + rest.items.length);
  });

  it("refuses live research without provider keys and keeps guests out of live and owner settings", async () => {
    const { cookie } = await owner();
    const live = await call(research.POST, "/research", { method: "POST", cookie, body: RICH, headers: { "Idempotency-Key": idem() } });
    expect(live.status).toBe(503);
    expect(ApiErrorBodySchema.parse(await body(live)).error.code).toBe("live_not_configured");
    const ownerSettings = SettingsResponseSchema.parse(await body(await call(settings.GET, "/settings", { cookie })));
    expect(ownerSettings.owner?.providers).toMatchObject({ liveReady: false, workerKeys: null, search: { configured: false }, model: { configured: false } });
    expect(JSON.stringify(ownerSettings)).not.toMatch(/tvly-|sk-ant-/);

    const other = await otherAccount();
    expect((await call(workspace.PUT, "/me/workspace", { method: "PUT", cookie: other.cookie, body: { workspace: "live" } })).status).toBe(403);
    const guestSettings = SettingsResponseSchema.parse(await body(await call(settings.GET, "/settings", { cookie: other.cookie })));
    expect(guestSettings.owner).toBeNull();
    const prefs = MeResponseSchema.parse(await body(await call(preferences.PATCH, "/me/preferences", { method: "PATCH", cookie: other.cookie, body: { locale: "az", timezone: "Europe/Moscow" } })));
    expect(prefs.preferences).toEqual({ locale: "az", timezone: "Europe/Moscow" });
    expect((await call(preferences.PATCH, "/me/preferences", { method: "PATCH", cookie: other.cookie, body: { timezone: "Mars/Olympus" } })).status).toBe(400);
  });

  it("serves the fictional examples and demo source pages", async () => {
    const { cookie } = await owner();
    const list = ExamplesResponseSchema.parse(await body(await call(examples.GET, "/examples", { cookie })));
    expect(list.items.length).toBeGreaterThanOrEqual(5);
    await call(workspace.PUT, "/me/workspace", { method: "PUT", cookie, body: { workspace: "demo" } });
    const done = await startAndFinish(cookie);
    const detail = ProfileDetailSchema.parse(await body(await call(profile.GET, "", { cookie, params: { profileId: done.profileId! } })));
    const key = detail.sources[0].fixtureKey!;
    const source = DemoSourceSchema.parse(await body(await call(demoSource.GET, "", { cookie, params: { key } })));
    expect(source.url).toMatch(/example/);
    expect((await call(demoSource.GET, "", { cookie, params: { key: "../../etc/passwd" } })).status).toBe(404);
  });
});

describe("/api/v1 — owner isolation", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("another signed-in account cannot see or change anything that belongs to the owner", async () => {
    const own = await owner();
    await call(workspace.PUT, "/me/workspace", { method: "PUT", cookie: own.cookie, body: { workspace: "demo" } });
    const done = await startAndFinish(own.cookie);
    const profileId = done.profileId!;
    const note = NoteSchema.parse(await body(await call(notesRoute.POST, "", { method: "POST", cookie: own.cookie, body: { body: "Owner only" }, params: { profileId } })));
    const tags = ProfileTagsResponseSchema.parse(await body(await call(tagsRoute.POST, "", { method: "POST", cookie: own.cookie, body: { name: "vip" }, params: { profileId } })));
    const ownSessions = SessionListResponseSchema.parse(await body(await call(sessionsRoute.GET, "/sessions", { cookie: own.cookie })));

    const other = await otherAccount();
    const c = other.cookie;
    const expect404 = async (res: Promise<Response>) => {
      const r = await res;
      expect(r.status).toBe(404);
      expect(ApiErrorBodySchema.parse(await body(r)).error.code).toBe("not_found");
    };
    await expect404(call(job.GET, "", { cookie: c, params: { jobId: done.id } }));
    await expect404(call(job.DELETE, "", { method: "DELETE", cookie: c, params: { jobId: done.id } }));
    await expect404(call(cancel.POST, "", { method: "POST", cookie: c, params: { jobId: done.id } }));
    await expect404(call(retry.POST, "", { method: "POST", cookie: c, headers: { "Idempotency-Key": idem() }, params: { jobId: done.id } }));
    await expect404(call(select.POST, "", { method: "POST", cookie: c, body: { candidateId: "00000000-0000-4000-8000-000000000000" }, params: { jobId: done.id } }));
    await expect404(call(profile.GET, "", { cookie: c, params: { profileId } }));
    await expect404(call(profile.DELETE, "", { method: "DELETE", cookie: c, params: { profileId } }));
    await expect404(call(saved.PUT, "", { method: "PUT", cookie: c, body: { saved: true }, params: { profileId } }));
    await expect404(call(refresh.POST, "", { method: "POST", cookie: c, headers: { "Idempotency-Key": idem() }, params: { profileId } }));
    await expect404(call(changes.GET, "", { cookie: c, params: { profileId } }));
    await expect404(call(notesRoute.POST, "", { method: "POST", cookie: c, body: { body: "intrusion" }, params: { profileId } }));
    await expect404(call(noteRoute.PATCH, "", { method: "PATCH", cookie: c, body: { body: "intrusion" }, params: { profileId, noteId: note.id } }));
    await expect404(call(noteRoute.DELETE, "", { method: "DELETE", cookie: c, params: { profileId, noteId: note.id } }));
    await expect404(call(tagsRoute.POST, "", { method: "POST", cookie: c, body: { name: "x" }, params: { profileId } }));
    await expect404(call(tagRoute.DELETE, "", { method: "DELETE", cookie: c, params: { profileId, tagId: tags.tags[0].id } }));
    await expect404(call(issues.POST, "", { method: "POST", cookie: c, body: { category: "other", message: "x" }, params: { profileId } }));
    await expect404(call(exportRoute.GET, "?format=pdf", { cookie: c, params: { profileId } }));
    await expect404(call(exportRoute.GET, "?format=json&notes=1", { cookie: c, params: { profileId } }));
    await expect404(call(sessionRoute.DELETE, "", { method: "DELETE", cookie: c, params: { sessionId: ownSessions.items[0].id } }));
    expect(JobListResponseSchema.parse(await body(await call(research.GET, "/research", { cookie: c }))).items).toEqual([]);
    expect(ProfileListResponseSchema.parse(await body(await call(profilesRoute.GET, "/profiles?scope=all", { cookie: c }))).items).toEqual([]);
    expect((await body<{ items: unknown[] }>(await call(allTags.GET, "/tags", { cookie: c }))).items).toEqual([]);
    // A client-supplied owner id is ignored: ownership always comes from the session.
    expect((await call(profile.GET, `?ownerId=${own.id}`, { cookie: c, params: { profileId } })).status).toBe(404);

    // The owner's data is unchanged.
    const detail = ProfileDetailSchema.parse(await body(await call(profile.GET, "", { cookie: own.cookie, params: { profileId } })));
    expect(detail.notes.map((n) => n.body)).toEqual(["Owner only"]);
    expect(detail.tags.map((t) => t.name)).toEqual(["vip"]);
    expect(SessionListResponseSchema.parse(await body(await call(sessionsRoute.GET, "/sessions", { cookie: own.cookie }))).items).toHaveLength(1);
  });
});

describe("/api/v1 — research notifications", () => {
  beforeEach(async () => {
    await resetDb();
  });

  function fakeTransport(errors: Record<string, string> = {}) {
    const sent: ExpoMessage[][] = [];
    const transport: PushTransport = {
      async send(messages) {
        sent.push(messages);
        return messages.map((m, i) => (errors[m.to] ? { status: "error" as const, details: { error: errors[m.to] } } : { status: "ok" as const, id: `ticket-${sent.length}-${i}` }));
      },
      async receipts() {
        return {};
      },
    };
    return { sent, transport };
  }

  it("notifies the owner's registered phone once, with generic text, and forgets the device on sign-out", async () => {
    const own = await owner();
    await call(workspace.PUT, "/me/workspace", { method: "PUT", cookie: own.cookie, body: { workspace: "demo" } });
    const token = "ExponentPushToken[abcdefghijklmnop]";
    const registered = DeviceResponseSchema.parse(await body(await call(device.PUT, "/devices/current", { method: "PUT", cookie: own.cookie, body: { pushToken: token, platform: "ios", appVersion: "1.0.0" } })));
    expect(registered.device?.platform).toBe("ios");
    expect((await call(device.PUT, "/devices/current", { method: "PUT", cookie: own.cookie, body: { pushToken: "not-a-token", platform: "ios" } })).status).toBe(400);

    const done = await startAndFinish(own.cookie);
    const { sent, transport } = fakeTransport();
    const env = { PUSH_NOTIFICATIONS_ENABLED: true, EXPO_ACCESS_TOKEN: undefined };
    expect(await dispatchPushNotifications(db(), env, { transport })).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0][0]).toMatchObject({ to: token, title: "Research finished", data: { type: "research", jobId: done.id, profileId: done.profileId } });
    // Lock-screen text never names the person.
    expect(JSON.stringify(sent[0][0].title + sent[0][0].body)).not.toMatch(/Elnara|Gasimova|Caspian/);
    // De-duplicated across passes (and across workers, via the unique index).
    expect(await dispatchPushNotifications(db(), env, { transport })).toBe(0);
    expect(sent).toHaveLength(1);
    const status = DeviceResponseSchema.parse(await body(await call(device.GET, "/devices/current", { cookie: own.cookie })));
    expect(status.device?.lastDelivery).toMatchObject({ status: "sent", error: null });

    // Sign-out removes the registration with the session.
    await authCall("/sign-out", { method: "POST", cookie: own.cookie, body: {} });
    expect(await db().select().from(pushDevices)).toEqual([]);
  });

  it("drops tokens the push service no longer knows and moves a token to the account now using the phone", async () => {
    const own = await owner();
    await call(workspace.PUT, "/me/workspace", { method: "PUT", cookie: own.cookie, body: { workspace: "demo" } });
    const token = "ExponentPushToken[shared-phone-token]";
    await call(device.PUT, "/devices/current", { method: "PUT", cookie: own.cookie, body: { pushToken: token, platform: "android" } });
    const other = await otherAccount();
    await call(device.PUT, "/devices/current", { method: "PUT", cookie: other.cookie, body: { pushToken: token, platform: "android" } });
    const rows = await db().select().from(pushDevices);
    expect(rows).toHaveLength(1);
    expect(rows[0].ownerId).toBe(other.id);

    await call(device.PUT, "/devices/current", { method: "PUT", cookie: own.cookie, body: { pushToken: "ExponentPushToken[owner-new-token]", platform: "android" } });
    await startAndFinish(own.cookie);
    const { transport } = fakeTransport({ "ExponentPushToken[owner-new-token]": "DeviceNotRegistered" });
    await dispatchPushNotifications(db(), { PUSH_NOTIFICATIONS_ENABLED: true, EXPO_ACCESS_TOKEN: undefined }, { transport });
    const remaining = await db().select().from(pushDevices);
    expect(remaining.map((d) => d.pushToken)).toEqual([token]);
    const [delivery] = await db().select().from(pushDeliveries);
    expect(delivery.status).toBe("failed");
    expect((await call(device.DELETE, "/devices/current", { method: "DELETE", cookie: other.cookie })).status).toBe(204);
    expect(await db().select().from(pushDevices)).toEqual([]);
    expect(await db().select({ n: sql<number>`count(*)::int` }).from(sessions).where(eq(sessions.userId, own.id))).toEqual([{ n: 1 }]);
  });
});

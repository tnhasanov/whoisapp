import { MeResponseSchema } from "@personbrief/shared/api/v1";
import { secureStore } from "../../test/native-mocks";
import { ApiError, onUnauthorized, onUpgradeRequired, request } from "../lib/api";
import meFixture from "../../test/fixtures/me-owner-demo.json";

function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

describe("API client", () => {
  beforeEach(() => {
    secureStore.clear();
    // What the Better Auth Expo plugin stores after sign-in.
    secureStore.set("personbrief_cookie", JSON.stringify({ "personbrief.session_token": { value: "token.signature", expires: null } }));
  });

  it("sends the stored session cookie, the client build and the idempotency key, and validates the response", async () => {
    const fetchMock = jest.fn(async () => respond(200, meFixture));
    global.fetch = fetchMock as unknown as typeof fetch;
    const me = await request("/me", { schema: MeResponseSchema, idempotencyKey: "abcdefgh12345" });
    expect(me.user.role).toBe("owner");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("http://192.168.1.20:3000/api/v1/me");
    expect(init.headers.cookie).toBe("personbrief.session_token=token.signature");
    expect(init.headers["X-PersonBrief-Client"]).toBe("ios/1.0.0/1");
    expect(init.headers["Idempotency-Key"]).toBe("abcdefgh12345");
    expect(init.credentials).toBe("omit");
  });

  it("reports a lost session once, and asks old builds to update", async () => {
    const lost = jest.fn();
    const upgrade = jest.fn();
    const offA = onUnauthorized(lost);
    const offB = onUpgradeRequired(upgrade);
    global.fetch = jest.fn(async () => respond(401, { error: { code: "unauthenticated", message: "Sign in to continue." } })) as unknown as typeof fetch;
    await expect(request("/me")).rejects.toMatchObject({ kind: "http", code: "unauthenticated", status: 401 });
    expect(lost).toHaveBeenCalledTimes(1);
    // Checking a stored session at launch does not count as losing it.
    await expect(request("/me", { quietUnauthorized: true })).rejects.toMatchObject({ code: "unauthenticated" });
    expect(lost).toHaveBeenCalledTimes(1);
    global.fetch = jest.fn(async () => respond(426, { error: { code: "unsupported_client", message: "Update" } })) as unknown as typeof fetch;
    await expect(request("/me")).rejects.toMatchObject({ code: "unsupported_client" });
    expect(upgrade).toHaveBeenCalledTimes(1);
    offA();
    offB();
  });

  it("keeps typed field errors and retry hints", async () => {
    global.fetch = jest.fn(async () =>
      respond(400, { error: { code: "invalid_input", message: "Please correct the highlighted fields.", fieldErrors: { fullName: "name_required" } } }),
    ) as unknown as typeof fetch;
    const error = (await request("/research", { method: "POST", body: { fullName: "" } }).catch((e) => e)) as ApiError;
    expect(error.fieldErrors).toEqual({ fullName: "name_required" });
    global.fetch = jest.fn(async () => respond(429, { error: { code: "rate_limited", message: "Wait", retryAfterSeconds: 30 } })) as unknown as typeof fetch;
    expect(await request("/research").catch((e) => e)).toMatchObject({ code: "rate_limited", retryAfterSeconds: 30 });
  });

  it("separates offline, timeouts and responses it does not understand", async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError("Network request failed");
    }) as unknown as typeof fetch;
    const offline = (await request("/me").catch((e) => e)) as ApiError;
    expect(offline.kind).toBe("network");
    expect(offline.isOffline).toBe(true);

    global.fetch = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    ) as unknown as typeof fetch;
    const slow = (await request("/me", { timeoutMs: 20 }).catch((e) => e)) as ApiError;
    expect(slow.kind).toBe("timeout");

    global.fetch = jest.fn(async () => respond(200, { user: "unexpected" })) as unknown as typeof fetch;
    expect(await request("/me", { schema: MeResponseSchema }).catch((e) => e)).toMatchObject({ kind: "incompatible" });
  });
});

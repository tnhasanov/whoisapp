import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import me from "../../test/fixtures/me-owner-demo.json";
import { fileSystem, secureStore } from "../../test/native-mocks";
import { fakeServer } from "../../test/render";
import { request } from "../lib/api";
import { I18nProvider } from "../lib/i18n";
import { SessionProvider, useSession } from "../lib/session";

const COOKIE_KEY = "personbrief_cookie";
const storeCookie = (value: string) => secureStore.set(COOKIE_KEY, JSON.stringify({ "personbrief.session_token": { value, expires: null } }));

// The Better Auth client is exercised against a real server in test/api; here it is a keychain stand-in.
jest.mock("../lib/auth-client", () => {
  const { secureStore: store } = require("../../test/native-mocks");
  const read = () => {
    const raw = store.get("personbrief_cookie");
    const parsed = raw ? (JSON.parse(raw) as Record<string, { value: string }>) : {};
    return Object.entries(parsed).map(([k, v]) => `${k}=${v.value}`).join("; ");
  };
  const client = {
    signIn: {
      email: jest.fn(async ({ password }: { password: string }) => {
        if (password !== "correct horse battery") return { data: null, error: { status: 401 } };
        store.set("personbrief_cookie", JSON.stringify({ "personbrief.session_token": { value: "user-b", expires: null } }));
        return { data: {}, error: null };
      }),
      anonymous: jest.fn(async () => ({ data: null, error: { status: 404 } })),
    },
    signOut: jest.fn(async () => {
      store.set("personbrief_cookie", "{}");
      return { data: { success: true }, error: null };
    }),
    getCookie: jest.fn(async () => read()),
  };
  return { getAuthClient: () => client, sessionCookie: async () => read() };
});

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <SessionProvider>{children}</SessionProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
  const hook = renderHook(() => useSession(), { wrapper });
  return { queryClient, ...hook };
}

beforeEach(() => {
  secureStore.clear();
  fileSystem.deleted.length = 0;
  fileSystem.created.clear();
});

describe("session lifecycle", () => {
  it("starts signed out when the keychain holds no session", async () => {
    fakeServer([]);
    const { result } = setup();
    await waitFor(() => expect(result.current.state).toEqual({ status: "signedOut", notice: null }));
  });

  it("restores a stored session after a restart", async () => {
    storeCookie("user-a");
    const requests = fakeServer([{ path: "/me", body: me }]);
    const { result, queryClient } = setup();
    await waitFor(() => expect(result.current.state).toEqual({ status: "signedIn", userId: me.user.id }));
    expect(requests[0].headers.cookie).toBe("personbrief.session_token=user-a");
    expect(queryClient.getQueryData(["u", me.user.id, "me"])).toMatchObject({ user: { email: me.user.email } });
  });

  it("drops an expired or revoked session and everything cached with it", async () => {
    storeCookie("revoked");
    // An export left from earlier use.
    fileSystem.created.add("file:///cache/personbrief-exports");
    fakeServer([{ path: "/me", status: 401, body: { error: { code: "unauthenticated", message: "Sign in to continue." } } }]);
    const { result } = setup();
    await waitFor(() => expect(result.current.state).toEqual({ status: "signedOut", notice: "expired" }));
    expect(secureStore.get(COOKIE_KEY)).toBe("{}");
    expect(fileSystem.deleted.some((uri) => uri.includes("personbrief-exports"))).toBe(true);
  });

  it("keeps the session but shows nothing when the server cannot be reached, and recovers", async () => {
    storeCookie("user-a");
    fakeServer([]);
    global.fetch = jest.fn(async () => {
      throw new TypeError("Network request failed");
    }) as unknown as typeof fetch;
    const { result } = setup();
    await waitFor(() => expect(result.current.state.status).toBe("unreachable"));
    expect(secureStore.get(COOKIE_KEY)).toContain("user-a");
    fakeServer([{ path: "/me", body: me }]);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.status).toBe("signedIn"));
  });

  it("clears the previous account's data before another account signs in", async () => {
    fakeServer([{ path: "/me", body: { ...me, user: { ...me.user, id: "user-b-id", email: "b@example.test" } } }]);
    const { result, queryClient } = setup();
    await waitFor(() => expect(result.current.state.status).toBe("signedOut"));
    queryClient.setQueryData(["u", "user-a-id", "profile", "x", "latest"], { secret: "user A brief" });
    expect(await act(() => result.current.signIn("b@example.test", "wrong"))).toEqual({ ok: false, reason: "invalid" });
    expect(await act(() => result.current.signIn("b@example.test", "correct horse battery"))).toEqual({ ok: true });
    expect(result.current.state).toEqual({ status: "signedIn", userId: "user-b-id" });
    expect(queryClient.getQueryData(["u", "user-a-id", "profile", "x", "latest"])).toBeUndefined();
  });

  it("signs out on the server, turns notifications off and removes local data", async () => {
    storeCookie("user-a");
    secureStore.set("pb.notifications", "on");
    const requests = fakeServer([{ path: "/me", body: me }, { method: "DELETE", path: "/devices/current", status: 204 }]);
    const { result, queryClient } = setup();
    await waitFor(() => expect(result.current.state.status).toBe("signedIn"));
    await act(() => result.current.signOut());
    expect(requests.some((r) => r.method === "DELETE" && r.path === "/devices/current" && r.headers.cookie === "personbrief.session_token=user-a")).toBe(true);
    expect(secureStore.get(COOKIE_KEY)).toBe("{}");
    expect(secureStore.has("pb.notifications")).toBe(false);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(result.current.state).toEqual({ status: "signedOut", notice: "signedOut" });
  });

  it("signs out when the server reports the session gone while the app is in use", async () => {
    storeCookie("user-a");
    fakeServer([{ path: "/me", body: me }, { path: "/research", status: 401, body: { error: { code: "unauthenticated", message: "Sign in to continue." } } }]);
    const { result } = setup();
    await waitFor(() => expect(result.current.state.status).toBe("signedIn"));
    await act(() => request("/research").catch(() => undefined));
    await waitFor(() => expect(result.current.state).toEqual({ status: "signedOut", notice: "expired" }));
  });
});

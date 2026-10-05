import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { MeResponseSchema, type MeResponse } from "@personbrief/shared/api/v1";
import { ApiError, onUnauthorized, onUpgradeRequired, request } from "./api";
import { getAuthClient, sessionCookie } from "./auth-client";
import { API_CONFIG } from "./config";
import { deleteTemporaryExports } from "./exports";
import { useLocaleState } from "./i18n";
import { unregisterThisDevice } from "./notifications";

/**
 * Who is signed in. The session itself lives on the server (Better Auth); the
 * device only holds its cookie in SecureStore. Signing out — or the server
 * reporting the session expired or revoked — clears every cached response
 * and temporary export before the sign-in screen shows, so one account's data
 * can never flash up for the next.
 */

export type SessionState =
  | { status: "booting" }
  | { status: "misconfigured" }
  | { status: "upgradeRequired" }
  | { status: "signedOut"; notice: "expired" | "signedOut" | null }
  | { status: "unreachable"; error: ApiError }
  | { status: "signedIn"; userId: string };

export type SignInResult = { ok: true } | { ok: false; reason: "invalid" | "rate_limited" | "offline" | "demo_unavailable" | "failed" };

type SessionContext = {
  state: SessionState;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signInDemo: () => Promise<SignInResult>;
  signOut: () => Promise<void>;
  retry: () => void;
};

const Ctx = createContext<SessionContext | null>(null);

function meKey(userId: string) {
  return ["u", userId, "me"] as const;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { applyAccount } = useLocaleState();
  const [state, setState] = useState<SessionState>(API_CONFIG.ok ? { status: "booting" } : { status: "misconfigured" });
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const clearLocalData = useCallback(async () => {
    queryClient.cancelQueries();
    queryClient.clear();
    await deleteTemporaryExports();
  }, [queryClient]);

  const enter = useCallback(
    (me: MeResponse) => {
      queryClient.setQueryData(meKey(me.user.id), me);
      applyAccount(me.preferences);
      setState({ status: "signedIn", userId: me.user.id });
    },
    [queryClient, applyAccount],
  );

  /** Forget the session on this phone (cookie, cached responses, temporary exports) — no state change. */
  const forgetLocally = useCallback(async () => {
    try {
      // The Expo plugin clears the stored cookie before the request is sent.
      await getAuthClient().signOut();
    } catch {
      // Offline or already revoked: the local cookie is cleared regardless.
    }
    await clearLocalData();
    applyAccount(null);
  }, [clearLocalData, applyAccount]);

  const dropLocalSession = useCallback(
    async (notice: "expired" | "signedOut" | null) => {
      await forgetLocally();
      setState({ status: "signedOut", notice });
    },
    [forgetLocally],
  );

  /** What the stored session (if any) means now, according to the server. */
  const checkStoredSession = useCallback(async (): Promise<SessionState> => {
    if (Platform.OS !== "web" && !(await sessionCookie())) return { status: "signedOut", notice: null };
    try {
      const me = await request("/me", { schema: MeResponseSchema, quietUnauthorized: true });
      queryClient.setQueryData(meKey(me.user.id), me);
      applyAccount(me.preferences);
      return { status: "signedIn", userId: me.user.id };
    } catch (error) {
      if (error instanceof ApiError && error.code === "unauthenticated") {
        await forgetLocally();
        return { status: "signedOut", notice: Platform.OS === "web" ? null : "expired" };
      }
      if (error instanceof ApiError && error.status === 426) return { status: "upgradeRequired" };
      return { status: "unreachable", error: error instanceof ApiError ? error : new ApiError("network", "offline", String(error)) };
    }
  }, [queryClient, applyAccount, forgetLocally]);

  useEffect(() => {
    if (!API_CONFIG.ok) return;
    let active = true;
    void checkStoredSession().then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, [checkStoredSession]);

  const retry = useCallback(() => {
    setState({ status: "booting" });
    void checkStoredSession().then(setState);
  }, [checkStoredSession]);

  useEffect(() => {
    const offUnauthorized = onUnauthorized(() => {
      if (stateRef.current.status === "signedIn") void dropLocalSession("expired");
    });
    const offUpgrade = onUpgradeRequired(() => setState({ status: "upgradeRequired" }));
    return () => {
      offUnauthorized();
      offUpgrade();
    };
  }, [dropLocalSession]);

  const finishSignIn = useCallback(async (): Promise<SignInResult> => {
    try {
      enter(await request("/me", { schema: MeResponseSchema, quietUnauthorized: true }));
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error instanceof ApiError && error.isOffline ? "offline" : "failed" };
    }
  }, [enter]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      await clearLocalData();
      try {
        const { error } = await getAuthClient().signIn.email({ email: email.trim().toLowerCase(), password, rememberMe: true });
        if (error) {
          if (error.status === 429) return { ok: false, reason: "rate_limited" };
          if (error.status === 401 || error.status === 400 || error.status === 403) return { ok: false, reason: "invalid" };
          return { ok: false, reason: error.status ? "failed" : "offline" };
        }
      } catch {
        return { ok: false, reason: "offline" };
      }
      return finishSignIn();
    },
    [clearLocalData, finishSignIn],
  );

  const signInDemo = useCallback(async (): Promise<SignInResult> => {
    await clearLocalData();
    try {
      const { error } = await getAuthClient().signIn.anonymous();
      if (error) return { ok: false, reason: error.status === 429 ? "rate_limited" : error.status === 404 ? "demo_unavailable" : "failed" };
    } catch {
      return { ok: false, reason: "offline" };
    }
    return finishSignIn();
  }, [clearLocalData, finishSignIn]);

  const signOut = useCallback(async () => {
    // Stop notifications for this phone first (needs the session), then revoke the session.
    await unregisterThisDevice().catch(() => undefined);
    await dropLocalSession("signedOut");
  }, [dropLocalSession]);

  const value = useMemo(() => ({ state, signIn, signInDemo, signOut, retry }), [state, signIn, signInDemo, signOut, retry]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionContext {
  const value = useContext(Ctx);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}

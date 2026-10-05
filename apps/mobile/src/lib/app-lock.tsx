import * as LocalAuthentication from "expo-local-authentication";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import { deviceStorage, PREF } from "./storage";

/**
 * Optional App lock: Face ID / Touch ID / fingerprint, with the device
 * passcode as fallback. It only hides the app's screens on this phone — the
 * server session and its expiry are unchanged, and anyone who cannot unlock
 * can still sign out (which removes the session from the phone).
 */

export type LockSupport = { available: boolean; enrolled: boolean; kinds: ("face" | "fingerprint" | "iris")[] };

type AppLockState = {
  enabled: boolean;
  locked: boolean;
  support: LockSupport | null;
  setEnabled: (value: boolean, prompt: string) => Promise<boolean>;
  unlock: (prompt: string) => Promise<boolean>;
};

const Ctx = createContext<AppLockState | null>(null);
/** Lock again after this long in the background. */
const RELOCK_AFTER_MS = 60_000;

export async function lockSupport(): Promise<LockSupport> {
  if (Platform.OS === "web") return { available: false, enrolled: false, kinds: [] };
  const [available, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const kinds = types.map((t) =>
    t === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION ? "face" : t === LocalAuthentication.AuthenticationType.IRIS ? "iris" : "fingerprint",
  ) as LockSupport["kinds"];
  return { available, enrolled, kinds };
}

async function authenticate(prompt: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, disableDeviceFallback: false, cancelLabel: undefined });
  return result.success;
}

export function AppLockProvider({ active, children }: { active: boolean; children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);
  const [support, setSupport] = useState<LockSupport | null>(null);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    void lockSupport().then(setSupport);
    void deviceStorage.get(PREF.appLock).then((value) => {
      const on = value === "on";
      setEnabledState(on);
      if (on) setLocked(true);
    });
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") backgroundedAt.current = Date.now();
      if (state === "active" && backgroundedAt.current !== null) {
        if (enabled && Date.now() - backgroundedAt.current > RELOCK_AFTER_MS) setLocked(true);
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled]);

  const unlock = useCallback(async (prompt: string) => {
    const ok = await authenticate(prompt);
    if (ok) setLocked(false);
    return ok;
  }, []);

  const setEnabled = useCallback(async (value: boolean, prompt: string) => {
    // Turning the lock on (or off) requires a successful check first.
    if (!(await authenticate(prompt))) return false;
    setEnabledState(value);
    if (value) await deviceStorage.set(PREF.appLock, "on");
    else await deviceStorage.remove(PREF.appLock);
    return true;
  }, []);

  const value = useMemo(() => ({ enabled, locked: active && enabled && locked, support, setEnabled, unlock }), [enabled, locked, active, support, setEnabled, unlock]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppLock(): AppLockState {
  const value = useContext(Ctx);
  if (!value) throw new Error("useAppLock must be used inside AppLockProvider");
  return value;
}

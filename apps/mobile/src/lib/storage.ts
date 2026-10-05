import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Small device preferences (theme, language before sign-in, app lock,
 * notification opt-in). Stored in the Keychain/Keystore through SecureStore
 * like the session cookie; research content is never stored on the device.
 * The web preview build falls back to localStorage.
 */

const PREFIX = "pb.";

export const deviceStorage = {
  async get(key: string): Promise<string | null> {
    try {
      if (Platform.OS === "web") return globalThis.localStorage?.getItem(PREFIX + key) ?? null;
      return await SecureStore.getItemAsync(PREFIX + key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === "web") globalThis.localStorage?.setItem(PREFIX + key, value);
      else await SecureStore.setItemAsync(PREFIX + key, value);
    } catch {
      // A preference that cannot be stored falls back to its default next launch.
    }
  },
  async remove(key: string): Promise<void> {
    try {
      if (Platform.OS === "web") globalThis.localStorage?.removeItem(PREFIX + key);
      else await SecureStore.deleteItemAsync(PREFIX + key);
    } catch {
      // ignore
    }
  },
};

/** Keys of preferences kept per device. */
export const PREF = {
  theme: "theme",
  locale: "locale",
  appLock: "appLock",
  notifications: "notifications",
} as const;

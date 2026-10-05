import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import * as Network from "expo-network";
import { AppState, Platform } from "react-native";
import { ApiError } from "./api";

/**
 * In-memory cache only: research content is fetched from the server and
 * never written to the device. Polling pauses while the app is in the
 * background and everything refreshes when it returns.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        // Reads are retried after network loss; client errors are not.
        retry: (failureCount, error) => {
          if (error instanceof ApiError && (error.kind === "http" || error.kind === "incompatible" || error.kind === "config")) {
            return error.status !== null && error.status >= 500 && failureCount < 2;
          }
          return failureCount < 3;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: {
        // Writes are never retried automatically: the user decides (and expensive
        // writes carry an Idempotency-Key so a manual retry cannot duplicate work).
        retry: false,
        networkMode: "always",
      },
    },
  });
}

let wired = false;

/** Tie React Query's focus and online state to the app lifecycle and the network. */
export function wireAppLifecycle() {
  if (wired || Platform.OS === "web") return;
  wired = true;
  focusManager.setEventListener((setFocused) => {
    const subscription = AppState.addEventListener("change", (state) => setFocused(state === "active"));
    return () => subscription.remove();
  });
  onlineManager.setEventListener((setOnline) => {
    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    return () => subscription.remove();
  });
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { renderRouter } from "expo-router/testing-library";
import type { ComponentType, ReactNode } from "react";
import { AccountSync } from "@/components/account-sync";
import { AppLockProvider } from "@/lib/app-lock";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";

/**
 * Renders route screens with the app's real providers and a fake server.
 * `routes` maps URL paths (or regular expressions) to JSON responses or
 * functions; anything unexpected fails loudly.
 */

export type Route = { method?: string; path: string | RegExp; status?: number; body?: unknown | ((request: CapturedRequest) => unknown) };
export type CapturedRequest = { method: string; url: string; path: string; headers: Record<string, string>; body: unknown };

export function fakeServer(routes: Route[]) {
  const requests: CapturedRequest[] = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = (init?.method ?? "GET").toUpperCase();
    const captured: CapturedRequest = {
      method,
      url: url.toString(),
      path: url.pathname.replace(/^\/api\/v1/, ""),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    };
    requests.push(captured);
    const route = routes.find((r) => (r.method ?? "GET") === method && (typeof r.path === "string" ? r.path === captured.path : r.path.test(captured.path)));
    if (!route) return new Response(JSON.stringify({ error: { code: "not_found", message: `No test route for ${method} ${captured.path}` } }), { status: 404 });
    const body = typeof route.body === "function" ? (route.body as (r: CapturedRequest) => unknown)(captured) : route.body;
    return new Response(route.status === 204 ? null : JSON.stringify(body ?? {}), { status: route.status ?? 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return requests;
}

export const signedInSession = {
  state: { status: "signedIn" as const, userId: "lnlgTTIBMBP3HNX1zQdmssrJ3MY0DbhO" },
  signIn: jest.fn(),
  signInDemo: jest.fn(),
  signOut: jest.fn(async () => undefined),
  retry: jest.fn(),
};

function Providers({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  return (
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <I18nProvider>
          <AppLockProvider active>
            <AccountSync />
            {children}
          </AppLockProvider>
        </I18nProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export function renderScreens(screens: Record<string, ComponentType>, initialUrl: string) {
  function Layout() {
    return (
      <Providers>
        <Stack />
      </Providers>
    );
  }
  return renderRouter({ _layout: Layout, ...screens }, { initialUrl });
}

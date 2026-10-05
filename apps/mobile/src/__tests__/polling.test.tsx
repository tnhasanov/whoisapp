import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import completed from "../../test/fixtures/job-completed.json";
import me from "../../test/fixtures/me-owner-demo.json";
import { fakeServer } from "../../test/render";
import { useJob } from "../lib/queries";

jest.mock("@/lib/session", () => ({ useSession: () => require("../../test/render").signedInSession }));

const running = { ...completed, status: "running", finishedAt: null, profileId: null, pollAfterMs: 2000 };

describe("research polling", () => {
  afterEach(() => {
    jest.useRealTimers();
    focusManager.setFocused(undefined);
  });

  it("polls at the server's pace, pauses in the background and reconciles on return", async () => {
    jest.useFakeTimers();
    let status = "running";
    const requests = fakeServer([
      { path: "/me", body: me },
      { path: `/research/${running.id}`, body: () => (status === "running" ? running : { ...completed, pollAfterMs: null }) },
    ]);
    const jobCalls = () => requests.filter((r) => r.path === `/research/${running.id}`).length;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useJob(running.id), { wrapper });
    await waitFor(() => expect(result.current.data?.status).toBe("running"));
    const first = jobCalls();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2100);
    });
    expect(jobCalls()).toBeGreaterThan(first);

    // App goes to the background: no requests while it stays there.
    act(() => focusManager.setFocused(false));
    const paused = jobCalls();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(20_000);
    });
    expect(jobCalls()).toBe(paused);

    // Meanwhile the server finished; coming back shows the current state at once.
    status = "completed";
    act(() => focusManager.setFocused(true));
    await waitFor(() => expect(result.current.data?.status).toBe("completed"));
    const settled = jobCalls();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(20_000);
    });
    // Finished runs are not polled any more.
    expect(jobCalls()).toBe(settled);
  });
});

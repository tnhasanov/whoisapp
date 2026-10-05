import { onlineManager } from "@tanstack/react-query";
import * as Sharing from "expo-sharing";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import { Alert, Linking } from "react-native";
import awaiting from "../../test/fixtures/job-awaiting.json";
import completed from "../../test/fixtures/job-completed.json";
import examples from "../../test/fixtures/examples.json";
import me from "../../test/fixtures/me-owner-demo.json";
import meta from "../../test/fixtures/meta.json";
import profile from "../../test/fixtures/profile-rich.json";
import recent from "../../test/fixtures/recent.json";
import settings from "../../test/fixtures/settings-owner.json";
import { fileSystem } from "../../test/native-mocks";
import { fakeServer, renderScreens, signedInSession, type Route } from "../../test/render";

jest.mock("@/lib/session", () => ({ useSession: () => require("../../test/render").signedInSession }));

import SearchScreen from "../app/(tabs)/index";
import SavedScreen from "../app/(tabs)/saved";
import SettingsScreen from "../app/(tabs)/settings";
import EvidenceSheet from "../app/evidence";
import BriefScreen from "../app/profile/[profileId]/index";
import ResearchScreen from "../app/research/[jobId]";

const PROFILE_ID = profile.profile.id;
const base: Route[] = [
  { path: "/me", body: me },
  { path: "/meta", body: meta },
  { path: "/research/recent", body: recent },
  { path: "/examples", body: examples },
  { path: "/settings", body: settings },
  { path: "/tags", body: { items: [] } },
  { path: `/profiles/${PROFILE_ID}`, body: profile },
];

const running = {
  ...completed,
  status: "running",
  outcome: null,
  profileId: null,
  snapshotId: null,
  finishedAt: null,
  currentStage: "extract",
  pollAfterMs: 2000,
  stages: completed.stages.map((s, i) => ({ ...s, status: i < 5 ? "completed" : i === 5 ? "running" : "pending" })),
};

beforeEach(() => {
  onlineManager.setOnline(true);
  fileSystem.downloads.length = 0;
  fileSystem.deleted.length = 0;
});

describe("Search", () => {
  it("validates the name, starts research with an idempotency key and opens the run", async () => {
    const requests = fakeServer([...base, { method: "POST", path: "/research", status: 201, body: { job: running, created: true } }, { path: `/research/${running.id}`, body: running }]);
    renderScreens({ "(tabs)/index": SearchScreen, "research/[jobId]": ResearchScreen }, "/");
    await screen.findByText("Fictional examples");

    fireEvent.press(screen.getByText("Start research"));
    expect(await screen.findByText("Enter the person's full name.")).toBeTruthy();
    expect(requests.some((r) => r.method === "POST")).toBe(false);

    fireEvent.changeText(screen.getByTestId("full-name"), "Elnara Gasimova");
    fireEvent.press(screen.getByText("Start research"));
    await waitFor(() => expect(requests.some((r) => r.method === "POST" && r.path === "/research")).toBe(true));
    const post = requests.find((r) => r.method === "POST")!;
    expect(post.body).toMatchObject({ fullName: "Elnara Gasimova" });
    expect(post.headers["Idempotency-Key"]).toMatch(/^[a-f0-9]{32}$/);
    expect(await screen.findByText("Researching Elnara Gasimova")).toBeTruthy();
  });

  it("never queues research while offline", async () => {
    fakeServer(base);
    renderScreens({ "(tabs)/index": SearchScreen }, "/");
    await screen.findByText("Start research");
    act(() => onlineManager.setOnline(false));
    expect(await screen.findByText(/searches are never queued offline/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start research" })).toBeDisabled();
  });
});

describe("Choose the person and progress", () => {
  it("shows distinct candidates and sends the owner's choice", async () => {
    const requests = fakeServer([
      ...base,
      { path: `/research/${awaiting.id}`, body: awaiting },
      { method: "POST", path: `/research/${awaiting.id}/select`, body: { ...awaiting, status: "queued", pollAfterMs: 3000 } },
    ]);
    renderScreens({ "research/[jobId]": ResearchScreen }, `/research/${awaiting.id}`);
    expect(await screen.findByText("Which Tural Mammadov do you mean?")).toBeTruthy();
    for (const c of awaiting.candidates) expect(screen.getAllByText(new RegExp(c.organisation!)).length).toBeGreaterThan(0);
    expect(screen.getByText("None of these — refine search")).toBeTruthy();
    fireEvent.press(screen.getAllByText("This is the person")[1]);
    await waitFor(() => expect(requests.find((r) => r.path.endsWith("/select"))?.body).toEqual({ candidateId: awaiting.candidates[1].id }));
  });

  it("reports persisted stages without invented percentages and confirms cancellation", async () => {
    const requests = fakeServer([...base, { path: `/research/${running.id}`, body: running }, { method: "POST", path: `/research/${running.id}/cancel`, body: { ...running, status: "cancelled", pollAfterMs: null } }]);
    const alert = jest.spyOn(Alert, "alert").mockImplementation((_title, _body, buttons) => buttons?.find((b) => b.style === "destructive")?.onPress?.());
    renderScreens({ "research/[jobId]": ResearchScreen }, `/research/${running.id}`);
    expect(await screen.findByText("Extract evidence")).toBeTruthy();
    expect(screen.getAllByText("In progress").length).toBeGreaterThan(0);
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.getByText(/You can leave this page/)).toBeTruthy();
    fireEvent.press(screen.getByText("Cancel research"));
    expect(alert).toHaveBeenCalledWith("Cancel this research?", expect.any(String), expect.any(Array));
    await waitFor(() => expect(requests.some((r) => r.method === "POST" && r.path.endsWith("/cancel"))).toBe(true));
    alert.mockRestore();
  });
});

describe("Person brief", () => {
  it("shows the header, the sections and opens evidence", async () => {
    fakeServer(base);
    const result = renderScreens({ "profile/[profileId]/index": BriefScreen, evidence: EvidenceSheet }, `/profile/${PROFILE_ID}`);
    expect(await screen.findByText("Elnara Gasimova")).toBeTruthy();
    expect(screen.getByText("Demo · fictional")).toBeTruthy();
    expect(screen.getByText(/Fictional demo data/)).toBeTruthy();
    expect(screen.getByText("Summary")).toBeTruthy();

    fireEvent.press(screen.getByRole("tab", { name: "Contacts & accounts" }));
    expect(await screen.findByText("Company switchboard")).toBeTruthy();
    // A switchboard is never presented as a direct line, and fictional numbers cannot be called.
    expect(screen.getAllByText("Not a direct line").length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText(/Fictional demo contact/).length).toBeGreaterThan(0);

    fireEvent.press(screen.getByRole("tab", { name: "Connections" }));
    expect(await screen.findByText("Documented relationships")).toBeTruthy();

    fireEvent.press(screen.getByRole("tab", { name: "News & media" }));
    expect(await screen.findByText("Unresolved same-name matches")).toBeTruthy();

    fireEvent.press(screen.getByRole("tab", { name: "Sources" }));
    expect(await screen.findByText("Search coverage")).toBeTruthy();
    fireEvent.press(screen.getAllByRole("button", { name: /^S?1: / })[0]);
    await waitFor(() => expect(result.getPathname()).toBe("/evidence"));
    // The source view says whether the page is about this person, and why.
    expect((await screen.findAllByText(/^(About the person|Identity unclear|Different person or unrelated)$/)).length).toBeGreaterThan(0);
  });

  it("shows a claim's sources, excerpt and verification in the evidence sheet", async () => {
    fakeServer(base);
    const claim = profile.claims.find((c) => c.evidence.length > 0)!;
    renderScreens({ evidence: EvidenceSheet }, `/evidence?profileId=${PROFILE_ID}&kind=claim&id=${claim.id}`);
    expect((await screen.findAllByText("Supporting excerpt")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Excerpt found verbatim in the retrieved text").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Open fictional source").length).toBeGreaterThan(0);
    expect(screen.getByText("Report an issue")).toBeTruthy();
  });

  it("shares a PDF through the share sheet with the session cookie and removes the temporary file", async () => {
    fakeServer(base);
    renderScreens({ "profile/[profileId]/index": BriefScreen }, `/profile/${PROFILE_ID}`);
    await screen.findByText("Elnara Gasimova");
    fireEvent.press(screen.getByRole("button", { name: "Share" }));
    fireEvent.press(await screen.findByText("PDF brief"));
    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalled());
    expect(fileSystem.downloads[0].url).toContain(`/api/v1/profiles/${PROFILE_ID}/export?format=pdf`);
    expect(fileSystem.downloads[0].url).not.toContain("notes=1");
    expect(fileSystem.deleted.length).toBeGreaterThan(0);
  });

  it("opens the dialer for a real published business number (never places the call)", async () => {
    fakeServer([...base.filter((r) => r.path !== `/profiles/${PROFILE_ID}`), { path: `/profiles/${PROFILE_ID}`, body: { ...profile, profile: { ...profile.profile, workspace: "live" } } }]);
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    renderScreens({ "profile/[profileId]/index": BriefScreen }, `/profile/${PROFILE_ID}`);
    await screen.findByText("Elnara Gasimova");
    fireEvent.press(screen.getByRole("tab", { name: "Contacts & accounts" }));
    fireEvent.press((await screen.findAllByRole("button", { name: "Call" }))[0]);
    await waitFor(() => expect(open).toHaveBeenCalledWith(expect.stringMatching(/^tel:\+?\d+$/)));
    open.mockRestore();
  });
});

describe("Saved work and settings", () => {
  it("explains an empty library", async () => {
    fakeServer([...base, { path: "/profiles", body: { items: [], nextCursor: null } }]);
    renderScreens({ "(tabs)/saved": SavedScreen }, "/saved");
    expect(await screen.findByText("Nothing saved yet")).toBeTruthy();
  });

  it("shows provider availability without secrets and an honest notifications state", async () => {
    fakeServer(base);
    renderScreens({ "(tabs)/settings": SettingsScreen }, "/settings");
    expect(await screen.findByText("Search: Tavily")).toBeTruthy();
    expect(screen.getAllByText("Missing").length).toBeGreaterThan(0);
    expect(await screen.findByText(/not linked to an Expo project/)).toBeTruthy();
    expect(screen.queryByText(/tvly-|sk-ant-/)).toBeNull();
  });

  it("says when the research worker has not picked up the provider keys", async () => {
    const providers = { ...settings.owner.providers, search: { ...settings.owner.providers.search, configured: true }, model: { ...settings.owner.providers.model, configured: true }, liveReady: false, workerKeys: false };
    fakeServer([...base.filter((r) => r.path !== "/settings"), { path: "/settings", body: { ...settings, owner: { ...settings.owner, providers } } }]);
    renderScreens({ "(tabs)/settings": SettingsScreen }, "/settings");
    expect(await screen.findByText("The research worker does not have the provider keys")).toBeTruthy();
    expect(screen.getByText(/redeploy the worker/)).toBeTruthy();
  });

  it("switches the interface to Azerbaijani and Russian, including long labels", async () => {
    fakeServer([...base.filter((r) => r.path !== "/me"), { path: "/me", body: { ...me, preferences: { locale: "az", timezone: "Asia/Baku" } } }]);
    const az = renderScreens({ "(tabs)/index": SearchScreen }, "/");
    expect(await screen.findByText("Araşdırmaya başlayın")).toBeTruthy();
    az.unmount();
    fakeServer([...base.filter((r) => r.path !== "/me"), { path: "/me", body: { ...me, preferences: { locale: "ru", timezone: "Europe/Moscow" } } }]);
    renderScreens({ "profile/[profileId]/index": BriefScreen }, `/profile/${PROFILE_ID}`);
    expect(await screen.findByRole("tab", { name: "Контакты и аккаунты" })).toBeTruthy();
  });
});

afterAll(() => {
  expect(signedInSession.signOut).not.toHaveBeenCalled();
});

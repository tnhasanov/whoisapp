import { expect, test } from "@playwright/test";
import { OWNER_STATE, profileIdFromUrl, runExample, waitForProfile } from "./support";

test.use({ storageState: OWNER_STATE });

test.describe("demo research flow", () => {
  test("search → progress → profile → tabs → evidence → save, notes, tags → refresh → What changed → export → delete", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
    page.on("pageerror", (e) => consoleErrors.push(e.message));

    await runExample(page, "Rich profile");
    // The progress screen shows real stages from the persisted job.
    await expect(page.getByRole("list", { name: /stages/i })).toBeVisible();
    await waitForProfile(page);
    const profileUrl = page.url();
    const profileId = profileIdFromUrl(profileUrl);

    // Header: fictional label, evidenced role, source count.
    await expect(page.getByRole("heading", { level: 1, name: "Elnara Gasimova" })).toBeVisible();
    await expect(page.getByText("Demo · fictional")).toBeVisible();
    await expect(page.getByText(/Chief Executive Officer/).first()).toBeVisible();
    await expect(page.getByText(/\d+ sources/).first()).toBeVisible();

    // Evidence drawer opens from a citation and closes with Escape, returning focus.
    const marker = page.getByRole("button", { name: /^Evidence for:/ }).first();
    await marker.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Supporting excerpt").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(marker).toBeFocused();

    // Contacts: the switchboard is labelled as not a direct line.
    await page.getByRole("link", { name: /Contacts/ }).first().click();
    await expect(page).toHaveURL(/\/contacts$/);
    await expect(page.getByText("+44 20 7946 0321").first()).toBeVisible();
    await expect(page.getByText("Organisation — not direct").first()).toBeVisible();

    // Connections: list and graph, with shared affiliations kept apart.
    await page.getByRole("link", { name: /Connections/ }).first().click();
    await expect(page.getByRole("heading", { name: "Shared affiliations" })).toBeVisible();
    await page.getByRole("radio", { name: "Graph" }).click();
    const node = page.getByRole("button", { name: /Martin Ellery/ }).first();
    await node.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");

    // News: syndicated copies are grouped; filters narrow the feed.
    await page.getByRole("link", { name: /News/ }).first().click();
    await expect(page.getByText(/more copies/).first()).toBeVisible();
    await page.getByLabel("Language").selectOption("ru");
    await expect(page.getByText("Эльнара Гасымова", { exact: false }).first()).toBeVisible();
    await page.getByRole("button", { name: "Reset filters" }).click();

    // Sources: the conflicting employment dates are listed.
    await page.getByRole("link", { name: /Sources/ }).first().click();
    await expect(page.getByRole("heading", { name: "Conflicting claims" })).toBeVisible();

    // Save, a private note and a tag.
    await page.goto(profileUrl);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: /Saved|Remove from saved/ }).first()).toBeVisible();
    await page.locator("#new-note").fill("Ask about the London expansion timeline.");
    await page.getByRole("button", { name: /Add note/i }).click();
    await expect(page.getByText("Ask about the London expansion timeline.")).toBeVisible();
    await page.getByLabel("Add tag", { exact: true }).fill("forum-2026");
    await page.getByRole("button", { name: "Add tag" }).click();
    await expect(page.getByText("forum-2026").first()).toBeVisible();

    // The library finds the profile by its note text.
    await page.goto("/profiles");
    await page.getByRole("searchbox").fill("London expansion");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: /Elnara Gasimova/ }).first()).toBeVisible();

    // Refresh keeps the first snapshot and reports what changed.
    await page.goto(profileUrl);
    await page.getByRole("button", { name: "Refresh" }).click();
    await page.waitForURL(/\/research\//);
    await waitForProfile(page);
    expect(profileIdFromUrl(page.url())).toBe(profileId);
    await page.getByRole("link", { name: "What changed?" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "What changed?" })).toBeVisible();
    await expect(page.getByText(/Executive Chair/).first()).toBeVisible();

    // Exports respect the session and are labelled as fictional.
    const pdf = await page.request.get(`/api/profiles/${profileId}/export?format=pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect(pdf.headers()["content-disposition"]).toMatch(/personbrief-DEMO-elnara-gasimova-v2\.pdf/);
    const json = await page.request.get(`/api/profiles/${profileId}/export?format=json`);
    const body = await json.json();
    expect(body.fictionalDemoData).toBe(true);
    expect(body.privateNotes).toBeUndefined();
    const withNotes = await (await page.request.get(`/api/profiles/${profileId}/export?format=json&notes=1`)).json();
    expect(withNotes.privateNotes.map((n: { body: string }) => n.body)).toContain("Ask about the London expansion timeline.");

    // Delete removes the profile everywhere.
    await page.goto(profileUrl);
    await page.getByRole("button", { name: "More", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Report an issue" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Delete profile" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete permanently" }).click();
    await page.waitForURL(/\/profiles(\?|$)/);
    const gone = await page.request.get(`/api/profiles/${profileId}/export?format=json`);
    expect(gone.status()).toBe(404);

    expect(consoleErrors).toEqual([]);
  });

  test("an ambiguous name asks which person is meant, and 'None of these' refines the search", async ({ page }) => {
    await runExample(page, "Ambiguous name");
    await expect(page.getByText(/3 different people/)).toBeVisible({ timeout: 60_000 });
    const cards = page.getByRole("button", { name: "This is the person" });
    await expect(cards).toHaveCount(3);
    await page.getByRole("button", { name: /None of these/ }).click();
    await page.waitForURL(/\/search/);
    await expect(page.getByLabel("Full name")).toHaveValue("Tural Mammadov");

    await runExample(page, "Ambiguous name");
    await expect(cards.first()).toBeVisible({ timeout: 60_000 });
    await cards.nth(1).click();
    await waitForProfile(page);
    await expect(page.getByRole("heading", { level: 1, name: "Tural Mammadov" })).toBeVisible();
  });

  test("a provider failure ends as a partial profile that a retry completes", async ({ page }) => {
    await runExample(page, "Provider failure");
    const choose = page.getByRole("button", { name: "This is the person" }).first();
    const profileOrChoice = await Promise.race([
      choose.waitFor({ timeout: 60_000 }).then(() => "choice" as const),
      page.waitForURL(/\/profiles\//, { timeout: 60_000 }).then(() => "profile" as const),
      page.getByRole("button", { name: "Retry" }).waitFor({ timeout: 60_000 }).then(() => "retry" as const),
    ]);
    if (profileOrChoice === "choice") await choose.click();
    // The run ends partial: the progress page offers Retry instead of spinning forever.
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Retry" }).click();
    await waitForProfile(page);
    await expect(page.getByText(/Partial research/)).toHaveCount(0);
  });
});

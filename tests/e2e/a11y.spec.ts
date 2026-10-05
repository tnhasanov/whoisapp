import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { deleteProfile, OWNER_STATE, runExample, waitForProfile } from "./support";

async function expectNoSeriousViolations(page: Page, label: string) {
  // Let the screen's entrance animation finish so colours are measured at full opacity.
  await page.waitForTimeout(400);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${label}: ${v.id} (${v.impact}) — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(serious).toEqual([]);
}

test("sign-in and privacy pages have no serious accessibility violations", async ({ page }) => {
  await page.goto("/sign-in");
  await expectNoSeriousViolations(page, "sign-in");
  await page.goto("/privacy");
  await expectNoSeriousViolations(page, "privacy");
});

test.describe("signed in", () => {
  test.use({ storageState: OWNER_STATE });

  test("main screens have no serious accessibility violations", async ({ page }) => {
    await page.goto("/search");
    await expectNoSeriousViolations(page, "search");
    await runExample(page, "Rich profile");
    await waitForProfile(page);
    const profileUrl = page.url();
    await expectNoSeriousViolations(page, "overview");
    for (const tab of ["contacts", "connections", "news", "sources"]) {
      await page.goto(`${profileUrl}/${tab}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoSeriousViolations(page, tab);
    }
    await page.goto(profileUrl);
    await page.getByRole("button", { name: /^Evidence for:/ }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoSeriousViolations(page, "evidence drawer");
    await page.keyboard.press("Escape");
    for (const path of ["/profiles", "/research", "/settings", "/data-use"]) {
      await page.goto(path);
      await expectNoSeriousViolations(page, path);
    }
    await deleteProfile(page, profileUrl);
  });

  test("the profile can be used with the keyboard alone", async ({ page }) => {
    await runExample(page, "Rich profile");
    await waitForProfile(page);
    const profileUrl = page.url();
    await page.goto("/profiles");
    const first = page.getByRole("link", { name: /Elnara Gasimova/ }).first();
    await first.focus();
    await page.keyboard.press("Enter");
    await waitForProfile(page);
    // From the top of the page, the first Tab reaches the skip link, which moves focus to the main content.
    await page.goto(page.url());
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    // Tab reaches a citation marker, Enter opens the evidence, Escape closes it.
    let reached = false;
    for (let i = 0; i < 60 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(() => document.activeElement?.getAttribute("aria-label")?.startsWith("Evidence for:") ?? false);
    }
    expect(reached).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")?.startsWith("Evidence for:"))).toBe(true);
    await deleteProfile(page, profileUrl);
  });
});

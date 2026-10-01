import { expect, test } from "@playwright/test";
import { deleteProfile, OWNER_STATE, runExample, waitForProfile } from "./support";

test.use({ storageState: OWNER_STATE });

test.describe("phone layout", () => {
  test("bottom navigation, full-screen evidence and no horizontal scrolling", async ({ page }) => {
    await page.goto("/search");
    const nav = page.getByRole("navigation", { name: /Main navigation/i }).filter({ visible: true }).last();
    await expect(nav).toBeVisible();
    await runExample(page, "Rich profile");
    await waitForProfile(page);
    const profileUrl = page.url();

    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await overflow()).toBeLessThanOrEqual(1);

    await page.getByRole("button", { name: /^Evidence for:/ }).first().click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    const box = (await drawer.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1);
    await page.getByRole("button", { name: "Close" }).click();
    await expect(drawer).toBeHidden();

    for (const tab of ["contacts", "connections", "news", "sources"]) {
      await page.goto(`${page.url().replace(/\/(contacts|connections|news|sources)$/, "")}/${tab}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await overflow(), `horizontal overflow on ${tab}`).toBeLessThanOrEqual(1);
    }
    await deleteProfile(page, profileUrl);
  });
});

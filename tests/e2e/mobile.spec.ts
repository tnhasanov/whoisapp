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

    // Evidence opens as a full-width bottom sheet; dragging its handle down closes it.
    await page.getByRole("button", { name: /^Evidence for:/ }).first().click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await page.waitForTimeout(450); // let the opening animation finish
    const box = (await drawer.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1);
    expect(box.y + box.height).toBeGreaterThanOrEqual(viewport.height - 1);
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.mouse.down();
    for (let step = 1; step <= 8; step++) await page.mouse.move(box.x + box.width / 2, box.y + 10 + step * 60);
    await page.mouse.up();
    await expect(drawer).toBeHidden();

    await page.getByRole("button", { name: /^Evidence for:/ }).first().click();
    await expect(drawer).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(drawer).toBeHidden();

    // Nested screens have their own back button (the installed app has no browser chrome).
    await page.goto(`${profileUrl}/news`);
    await page.getByRole("button", { name: "Back" }).click();
    await page.waitForURL(/\/profiles$/);
    await page.goto(profileUrl);

    for (const tab of ["contacts", "connections", "news", "sources"]) {
      await page.goto(`${page.url().replace(/\/(contacts|connections|news|sources)$/, "")}/${tab}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await overflow(), `horizontal overflow on ${tab}`).toBeLessThanOrEqual(1);
    }
    await deleteProfile(page, profileUrl);
  });
});

test.describe("installable app", () => {
  test("manifest, icons and an offline screen that never exposes private pages", async ({ page, context, request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest).toMatchObject({ name: "PersonBrief", display: "standalone", start_url: expect.stringMatching(/^\/search/) });
    for (const icon of manifest.icons as { src: string }[]) expect((await request.get(icon.src)).status()).toBe(200);
    expect((await request.get("/apple-icon.png")).status()).toBe(200);

    await page.goto("/search");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    const cached = await page.evaluate(async () => {
      const paths: string[] = [];
      for (const name of await caches.keys()) for (const r of await (await caches.open(name)).keys()) paths.push(new URL(r.url).pathname);
      return paths;
    });
    // Only build assets, icons and the offline notice are stored — never pages or data.
    expect(cached.every((p) => p.startsWith("/_next/static/") || p.startsWith("/icons/") || p.startsWith("/splash/") || p === "/offline.html")).toBe(true);

    await context.setOffline(true);
    await page.goto("/profiles").catch(() => undefined);
    await expect(page.getByRole("heading", { name: /offline/i })).toBeVisible();
    await context.setOffline(false);
  });

  test("settings explain how to add the app to the home screen", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "PersonBrief on your phone" })).toBeVisible();
  });
});

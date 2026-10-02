import { mkdirSync } from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { Pool } from "pg";
import { completeResearch, OWNER_STATE, runExample, switchWorkspace, waitForProfile } from "./support";

/**
 * Visual review: captures every main screen on desktop, phone and a narrow
 * phone into docs/screenshots. Run with `npm run test:e2e -- screenshots`.
 * All data shown is fictional demo data.
 */
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

test.describe.configure({ mode: "serial", timeout: 300_000 });

async function shot(page: Page, name: string, fullPage = true) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage, animations: "disabled" });
}

async function ownerPage(browser: Browser, viewport: { width: number; height: number }, extra: Parameters<Browser["newContext"]>[0] = {}) {
  const context = await browser.newContext({ storageState: OWNER_STATE, viewport, locale: "en-GB", timezoneId: "Asia/Baku", ...extra });
  return context.newPage();
}

async function setOwnerLocale(locale: "en" | "az" | "ru") {
  if (!process.env.E2E_DATABASE_URL) return false;
  const pool = new Pool({ connectionString: process.env.E2E_DATABASE_URL, max: 1 });
  await pool.query("UPDATE owner_settings SET locale = $1 WHERE user_id IN (SELECT id FROM auth_users WHERE role = 'owner')", [locale]);
  await pool.end();
  return true;
}

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const NARROW = { width: 320, height: 640 };

let richProfileUrl = "";

test("desktop: search, progress, profile tabs, drawer, What changed", async ({ browser }) => {
  const anon = await (await browser.newContext({ viewport: DESKTOP })).newPage();
  await anon.goto("/sign-in");
  await shot(anon, "desktop-01-sign-in");

  const page = await ownerPage(browser, DESKTOP);
  await page.goto("/search");
  await switchWorkspace(page, "Live");
  await shot(page, "desktop-02-search-live-not-configured");
  await switchWorkspace(page, "Demo");
  await shot(page, "desktop-03-search-demo");

  await runExample(page, "Rich profile");
  await page.waitForTimeout(1200);
  await shot(page, "desktop-04-research-progress", false);
  await waitForProfile(page);
  richProfileUrl = page.url().replace(/\?.*$/, "");
  await shot(page, "desktop-05-profile-overview");

  await page.getByRole("button", { name: /^Evidence for:/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await shot(page, "desktop-06-evidence-drawer", false);
  await page.keyboard.press("Escape");

  for (const [tab, name] of [
    ["contacts", "desktop-07-contacts-accounts"],
    ["news", "desktop-10-news"],
    ["sources", "desktop-11-sources"],
  ] as const) {
    await page.goto(`${richProfileUrl}/${tab}`);
    await shot(page, name);
  }
  await page.goto(`${richProfileUrl}/connections`);
  await shot(page, "desktop-08-connections-list");
  await page.getByRole("radio", { name: "Graph" }).click();
  await page.getByRole("button", { name: /Martin Ellery/ }).first().focus();
  await shot(page, "desktop-09-connections-graph");

  await page.goto(richProfileUrl);
  await page.getByRole("button", { name: "Refresh" }).click();
  await page.waitForURL(/\/research\//);
  await waitForProfile(page);
  await page.goto(`${richProfileUrl}/changes`);
  await shot(page, "desktop-12-what-changed");

  // PDF export rendered for review (fictional data).
  const profileId = /\/profiles\/([0-9a-f-]{36})/.exec(richProfileUrl)![1];
  const pdf = await page.request.get(`/api/profiles/${profileId}/export?format=pdf`);
  expect(pdf.status()).toBe(200);
  const { writeFileSync } = await import("node:fs");
  writeFileSync(`${OUT}/export-sample-brief.pdf`, await pdf.body());
});

test("desktop: identity choice, partial run, sparse profile and other screens", async ({ browser }) => {
  const page = await ownerPage(browser, DESKTOP);
  await runExample(page, "Ambiguous name");
  await expect(page.getByRole("button", { name: "This is the person" }).first()).toBeVisible({ timeout: 60_000 });
  await shot(page, "desktop-13-identity-selection");

  await runExample(page, "Provider failure");
  const choose = page.getByRole("button", { name: "This is the person" }).first();
  const retry = page.getByRole("button", { name: "Retry" });
  if ((await Promise.race([choose.waitFor({ timeout: 60_000 }).then(() => "choose"), retry.waitFor({ timeout: 60_000 }).then(() => "retry")])) === "choose") {
    await choose.click();
  }
  await expect(retry).toBeVisible({ timeout: 60_000 });
  await shot(page, "desktop-14-partial-run-with-retry");

  await runExample(page, "Sparse record");
  await completeResearch(page);
  await shot(page, "desktop-15-sparse-profile");
  await page.goto(`${page.url().replace(/\?.*$/, "")}/contacts`);
  await shot(page, "desktop-16-empty-contacts");

  for (const [path, name] of [
    ["/profiles", "desktop-17-library"],
    ["/research", "desktop-18-activity"],
    ["/settings", "desktop-19-settings"],
    ["/data-use", "desktop-20-data-use"],
    ["/demo/sources/caspian-forum-data-jobs-thread", "desktop-21-fixture-source-viewer"],
    ["/profiles/00000000-0000-4000-8000-000000000000", "desktop-22-not-found"],
  ] as const) {
    await page.goto(path);
    await shot(page, name);
  }
  if (richProfileUrl) {
    await page.goto(`${richProfileUrl}/report`);
    await shot(page, "desktop-23-report-issue");
  }

  const dark = await ownerPage(browser, DESKTOP, { colorScheme: "dark" });
  if (richProfileUrl) {
    await dark.goto(richProfileUrl);
    await shot(dark, "desktop-24-profile-dark-mode");
  }
});

test("phone and narrow phone layouts", async ({ browser }) => {
  // Phone captures are single screens: a full-page capture would paint the fixed bottom bar mid-page.
  for (const [label, viewport] of [
    ["phone", PHONE],
    ["narrow", NARROW],
  ] as const) {
    const page = await ownerPage(browser, viewport, {
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
    });
    await page.goto("/search");
    await shot(page, `${label}-01-search`, false);
    if (!richProfileUrl) continue;
    await page.goto(richProfileUrl);
    await shot(page, `${label}-02-profile-overview`, false);
    await page.getByRole("heading", { name: "Career" }).scrollIntoViewIfNeeded();
    await shot(page, `${label}-03-profile-career`, false);
    await page.getByRole("button", { name: /^Evidence for:/ }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await shot(page, `${label}-04-evidence-drawer`, false);
    await page.getByRole("button", { name: "Close" }).click();
    await page.goto(`${richProfileUrl}/contacts`);
    await page.getByRole("heading", { name: "Published business contacts" }).scrollIntoViewIfNeeded();
    await shot(page, `${label}-05-contacts`, false);
    await page.goto(`${richProfileUrl}/connections`);
    await page.getByRole("radio", { name: "Graph" }).click();
    await page.getByRole("group").first().scrollIntoViewIfNeeded();
    await shot(page, `${label}-06-connections-graph`, false);
    await page.goto(`${richProfileUrl}/news`);
    await page.getByRole("heading", { name: "Coverage" }).scrollIntoViewIfNeeded();
    await shot(page, `${label}-07-news`, false);
    if (label === "phone") {
      await page.goto("/profiles");
      await shot(page, `${label}-08-library`, false);
      await page.goto("/settings#app");
      await page.getByRole("heading", { name: "PersonBrief on your phone" }).scrollIntoViewIfNeeded();
      await shot(page, `${label}-09-install-app`, false);
      await page.goto("/offline.html");
      await shot(page, `${label}-10-offline`, false);
    }
  }
});

test("Azerbaijani and Russian interface", async ({ browser }) => {
  test.skip(!process.env.E2E_DATABASE_URL, "needs E2E_DATABASE_URL to switch the owner's language");
  try {
    for (const locale of ["az", "ru"] as const) {
      await setOwnerLocale(locale);
      const page = await ownerPage(browser, DESKTOP);
      // Server and browser must render identical text (dates included), so no hydration errors.
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/search");
      await shot(page, `desktop-25-${locale}-search`);
      if (richProfileUrl) {
        await page.goto(richProfileUrl);
        await shot(page, `desktop-26-${locale}-profile-overview`);
        await page.goto(`${richProfileUrl}/news`);
        await page.getByRole("heading", { level: 1 }).waitFor();
      }
      expect(errors, `console errors in ${locale}`).toEqual([]);
    }
  } finally {
    await setOwnerLocale("en");
  }
});

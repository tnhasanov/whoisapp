import { expect, type Page } from "@playwright/test";

export const OWNER = {
  email: process.env.E2E_OWNER_EMAIL ?? "e2e-owner@personbrief.test",
  password: process.env.E2E_OWNER_PASSWORD ?? "e2e-only-password-not-secret",
  name: "E2E Owner",
};

export const OWNER_STATE = "tests/e2e/.auth/owner.json";

/** The sidebar and the mobile top bar both render a workspace switch; use whichever is visible. */
export async function switchWorkspace(page: Page, workspace: "Live" | "Demo") {
  const radio = page.getByRole("radio", { name: workspace }).filter({ visible: true }).first();
  if ((await radio.getAttribute("aria-checked")) !== "true") {
    await radio.click();
    await expect(radio).toHaveAttribute("aria-checked", "true");
  }
}

/** Fill the search form from a demo example, start the research and wait for the progress page. */
export async function runExample(page: Page, label: string) {
  await page.goto("/search");
  await switchWorkspace(page, "Demo");
  await page.getByRole("button", { name: new RegExp(label, "i") }).click();
  await page.waitForURL(/\/search\?name=/);
  await page.getByRole("button", { name: "Start research" }).click();
  await page.waitForURL(/\/research\/[0-9a-f-]{36}/);
}

export async function waitForProfile(page: Page) {
  await page.waitForURL(/\/profiles\/[0-9a-f-]{36}/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

export function profileIdFromUrl(url: string): string {
  return /\/profiles\/([0-9a-f-]{36})/.exec(url)![1];
}

/** Wait for a run to finish: choose the given candidate if the identity screen appears, then wait for the profile. */
export async function completeResearch(page: Page, candidate = 0) {
  const choose = page.getByRole("button", { name: "This is the person" });
  const outcome = await Promise.race([
    choose.first().waitFor({ timeout: 60_000 }).then(() => "choose" as const),
    page.waitForURL(/\/profiles\/[0-9a-f-]{36}/, { timeout: 60_000 }).then(() => "profile" as const),
  ]);
  if (outcome === "choose") await choose.nth(candidate).click();
  await waitForProfile(page);
}

/** Delete the profile at `profileUrl` through the UI so later tests start without it. */
export async function deleteProfile(page: Page, profileUrl: string) {
  await page.goto(profileUrl.replace(/\/(contacts|connections|news|sources|changes|report)$/, ""));
  await page.getByRole("button", { name: "Delete profile" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete permanently" }).click();
  await page.waitForURL(/\/profiles(\?|$)/);
}

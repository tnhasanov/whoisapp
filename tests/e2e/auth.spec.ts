import { expect, test } from "@playwright/test";
import { OWNER } from "./support";

test.describe("access control", () => {
  test("private pages redirect to sign-in and APIs refuse anonymous requests", async ({ page, request }) => {
    await page.goto("/profiles");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fprofiles/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    const job = await request.get("/api/jobs/00000000-0000-4000-8000-000000000000");
    expect(job.status()).toBe(401);
    const exported = await request.get("/api/profiles/00000000-0000-4000-8000-000000000000/export?format=json");
    expect(exported.status()).toBe(401);
  });

  test("pages are excluded from indexing", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toMatch(/Disallow: \//);
    const signIn = await request.get("/sign-in");
    expect(signIn.headers()["x-robots-tag"]).toMatch(/noindex/);
    expect(signIn.headers()["x-frame-options"]).toBe("DENY");
  });

  test("a wrong password shows an error without revealing which part was wrong", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(OWNER.email);
    await page.getByLabel("Password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("the privacy page is public and shows no account data", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("link", { name: "Privacy" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "The phone app" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "If you were researched" })).toBeVisible();
    // No contact address is configured in the test server, so none is invented.
    await expect(page.getByText("contact the person who gave you access")).toBeVisible();
    await expect(page.locator("a[href^='mailto:']")).toHaveCount(0);
    await expect(page.getByText(OWNER.email)).toHaveCount(0);
  });

  test("public setup is closed once an owner exists", async ({ page }) => {
    await page.goto("/setup");
    await expect(page.getByText(/owner account already exists|Setup is not available/i).first()).toBeVisible();
  });
});

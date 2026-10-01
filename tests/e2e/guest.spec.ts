import { expect, test } from "@playwright/test";
import { Pool } from "pg";

test.describe("temporary demo guest", () => {
  test("a guest gets a labelled fictional workspace and cannot reach the owner's data", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Open the fictional demo" }).click();
    await page.waitForURL(/\/search/);
    await expect(page.getByText("Demo workspace — fictional data.").first()).toBeVisible();
    // Guests have no live workspace switch.
    await expect(page.getByRole("radio", { name: "Live" })).toHaveCount(0);
    await expect(page.getByText(/temporary demo workspace/i).first()).toBeVisible();

    // An empty library explains what will appear there.
    await page.goto("/profiles");
    await expect(page.getByText("No profiles yet")).toBeVisible();

    // Live settings are owner-only.
    await page.goto("/settings");
    await expect(page.getByText(/owner/i).first()).toBeVisible();

    // Any profile that belongs to someone else is simply not found.
    if (process.env.E2E_DATABASE_URL) {
      const pool = new Pool({ connectionString: process.env.E2E_DATABASE_URL, max: 1 });
      const { rows } = await pool.query<{ id: string }>("SELECT p.id FROM profiles p JOIN auth_users u ON u.id = p.owner_id WHERE u.role = 'owner' LIMIT 1");
      await pool.end();
      if (rows[0]) {
        const response = await page.goto(`/profiles/${rows[0].id}`);
        expect(response?.status()).toBe(404);
        const exported = await page.request.get(`/api/profiles/${rows[0].id}/export?format=json`);
        expect(exported.status()).toBe(404);
      }
    }
  });
});

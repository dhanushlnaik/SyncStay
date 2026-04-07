import { test, expect } from "@playwright/test";

test("auth page loads", async ({ page }) => {
  await page.goto("/auth/sign-in");
  await expect(page.getByText("Sign in to your workspace")).toBeVisible();
});

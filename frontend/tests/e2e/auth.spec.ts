import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should show auth page by default", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=TERMINAL.CHAT")).toBeVisible();
    await expect(page.locator("text=[ LOGIN ]")).toBeVisible();
    await expect(page.locator("text=[ REGISTER ]")).toBeVisible();
  });

  test("should register a new user and redirect to lobby", async ({ page }) => {
    await page.goto("/auth");

    // Click Register tab
    await page.click("text=[ REGISTER ]");

    // Fill registration form
    const timestamp = Date.now();
    await page.fill('[placeholder="choose username..."]', `testuser_${timestamp}`);
    await page.fill('[placeholder="choose password (min 6 chars)..."]', "password123");
    await page.fill('[placeholder="confirm password..."]', "password123");

    // Submit
    await page.click('button:has-text("[ CREATE ACCOUNT ]")');

    // Should redirect to lobby
    await expect(page).toHaveURL(/\/lobby/);
    await expect(page.locator("text=AVAILABLE ROOMS")).toBeVisible();
  });

  test("should login with existing credentials", async ({ page }) => {
    // First register
    await page.goto("/auth");
    await page.click("text=[ REGISTER ]");
    const timestamp = Date.now();
    const username = `logintest_${timestamp}`;
    await page.fill('[placeholder="choose username..."]', username);
    await page.fill('[placeholder="choose password (min 6 chars)..."]', "password123");
    await page.fill('[placeholder="confirm password..."]', "password123");
    await page.click('button:has-text("[ CREATE ACCOUNT ]")');
    await expect(page).toHaveURL(/\/lobby/);

    // Logout
    await page.click("text=[LOGOUT]");
    await expect(page).toHaveURL(/\/auth/);

    // Login
    await page.fill('[placeholder="enter username..."]', username);
    await page.fill('[placeholder="enter password..."]', "password123");
    await page.click('button:has-text("[ LOGIN ]")');

    await expect(page).toHaveURL(/\/lobby/);
  });
});

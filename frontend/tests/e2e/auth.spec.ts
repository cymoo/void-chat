import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

async function register(page: import("@playwright/test").Page, username: string, password: string) {
  await page.goto("/#/auth");
  await page.getByRole("button", { name: "REGISTER" }).click();
  const form = page.locator("form.auth-form.active");
  await form.locator('input[placeholder="anonymous"]').fill(username);
  await form.locator('input[autocomplete="new-password"]').first().fill(password);
  await form.locator('input[autocomplete="new-password"]').nth(1).fill(password);
  await form.locator("button.connect-btn").click();
}

test.describe("Authentication", () => {
  test("should show auth page by default", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=VOID.CHAT")).toBeVisible();
    await expect(page.locator(".auth-tabs .auth-tab", { hasText: "LOGIN" })).toBeVisible();
    await expect(page.locator(".auth-tabs .auth-tab", { hasText: "REGISTER" })).toBeVisible();
  });

  test("should register a new user and redirect to lobby", async ({ page }) => {
    await register(page, `testuser_${randomUUID().slice(0, 8)}`, "password123");
    await expect(page).toHaveURL(/#\/lobby/);
    await expect(page.locator("text=SELECT ROOM")).toBeVisible();
  });

  test("should login with existing credentials", async ({ page }) => {
    const username = `logintest_${randomUUID().slice(0, 8)}`;
    await register(page, username, "password123");
    await expect(page).toHaveURL(/#\/lobby/);

    await page.getByRole("button", { name: "LOGOUT" }).click();
    await expect(page).toHaveURL(/#\/auth/);

    const loginForm = page.locator("form.auth-form.active");
    await loginForm.locator('input[placeholder="anonymous"]').fill(username);
    await loginForm.locator('input[autocomplete="current-password"]').fill("password123");
    await loginForm.locator("button.connect-btn").click();
    await expect(page).toHaveURL(/#\/lobby/);
  });
});

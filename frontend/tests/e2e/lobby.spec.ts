import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

async function registerAndGoToLobby(page: import("@playwright/test").Page) {
  await page.goto("/#/auth");
  await page.getByRole("button", { name: "REGISTER" }).click();
  const form = page.locator("form.auth-form.active");
  const username = `lobbytest_${randomUUID().slice(0, 8)}`;
  await form.locator('input[placeholder="anonymous"]').fill(username);
  await form.locator('input[autocomplete="new-password"]').first().fill("password123");
  await form.locator('input[autocomplete="new-password"]').nth(1).fill("password123");
  await form.locator("button.connect-btn").click();
  await expect(page).toHaveURL(/#\/lobby/);
  return username;
}

test.describe("Lobby", () => {
  test("should show room list", async ({ page }) => {
    await registerAndGoToLobby(page);
    await expect(page.locator("text=SELECT ROOM")).toBeVisible();
    await expect(page.getByRole("button", { name: /NEW ROOM/i })).toBeVisible();
  });

  test("should create a new room", async ({ page }) => {
    await registerAndGoToLobby(page);

    await page.getByRole("button", { name: /NEW ROOM/i }).click();
    await expect(page.locator(".create-room-panel .panel-title")).toHaveText("NEW ROOM");

    const roomName = `TestRoom_${randomUUID().slice(0, 8)}`;
    await page.locator('input[placeholder="my-awesome-room"]').fill(roomName);
    await page.locator('input[placeholder="What is this room about?"]').fill("A test room");

    await page.getByRole("button", { name: /CREATE ROOM/i }).click();
    await expect(page).toHaveURL(/#\/chat\/\d+/);
  });
});

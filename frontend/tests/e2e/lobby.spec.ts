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

  test("online count should be zero after all users leave a room", async ({ browser }) => {
    const id = randomUUID().slice(0, 8);
    const roomName = `count_room_${id}`;

    // Register user A, create the room, enter it
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await registerAndGoToLobby(pageA);
    await pageA.getByRole("button", { name: /NEW ROOM/i }).click();
    await pageA.locator('input[placeholder="my-awesome-room"]').fill(roomName);
    await pageA.getByRole("button", { name: /CREATE ROOM/i }).click();
    await expect(pageA).toHaveURL(/#\/chat\/\d+/);
    const roomPath = pageA.url().split("#")[1] ?? "";

    // Register user B, enter the same room
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    const usernameB = `lobbyB_${id}`;
    await pageB.goto("/#/auth");
    await pageB.getByRole("button", { name: "REGISTER" }).click();
    const formB = pageB.locator("form.auth-form.active");
    await formB.locator('input[placeholder="anonymous"]').fill(usernameB);
    await formB.locator('input[autocomplete="new-password"]').first().fill("password123");
    await formB.locator('input[autocomplete="new-password"]').nth(1).fill("password123");
    await formB.locator("button.connect-btn").click();
    await expect(pageB).toHaveURL(/#\/lobby/);
    await pageB.goto(`/#${roomPath}`);
    await expect(pageB).toHaveURL(/#\/chat\/\d+/);

    // Wait for both users to be in the room
    await expect(pageA.locator(".room-status")).toContainText("2 ONLINE");

    // Both users go back to lobby
    await pageA.locator("button[title='Back to Lobby']").click();
    await expect(pageA).toHaveURL(/#\/lobby/);

    await pageB.locator("button[title='Back to Lobby']").click();
    await expect(pageB).toHaveURL(/#\/lobby/);

    // Wait for WebSocket disconnect to be processed
    await pageA.waitForTimeout(500);

    // Refresh the lobby to get fresh data
    await pageA.goto("/#/lobby");
    await expect(pageA.locator("text=SELECT ROOM")).toBeVisible();

    // The room should show 0 online
    const roomCard = pageA.locator(".room-card", { hasText: roomName });
    await expect(roomCard).toBeVisible();
    await expect(roomCard.locator(".room-card-meta")).toContainText("0 ONLINE");

    await contextA.close();
    await contextB.close();
  });
});

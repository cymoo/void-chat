import { test, expect } from "@playwright/test";

// Helper to register and reach the lobby
async function registerAndGoToLobby(page: import("@playwright/test").Page) {
  await page.goto("/auth");
  await page.click("text=[ REGISTER ]");
  const timestamp = Date.now();
  const username = `lobbytest_${timestamp}`;
  await page.fill('[placeholder="choose username..."]', username);
  await page.fill('[placeholder="choose password (min 6 chars)..."]', "password123");
  await page.fill('[placeholder="confirm password..."]', "password123");
  await page.click('button:has-text("[ CREATE ACCOUNT ]")');
  await expect(page).toHaveURL(/\/lobby/);
  return username;
}

test.describe("Lobby", () => {
  test("should show room list", async ({ page }) => {
    await registerAndGoToLobby(page);
    await expect(page.locator("text=AVAILABLE ROOMS")).toBeVisible();
    await expect(page.locator("text=[ + NEW ROOM ]")).toBeVisible();
  });

  test("should create a new room", async ({ page }) => {
    await registerAndGoToLobby(page);

    // Open create room dialog
    await page.click("text=[ + NEW ROOM ]");
    await expect(page.locator("text=CREATE NEW ROOM")).toBeVisible();

    // Fill in room details
    const roomName = `TestRoom_${Date.now()}`;
    await page.fill('[placeholder="enter room name..."]', roomName);
    await page.fill('[placeholder="describe your room..."]', "A test room");

    // Submit
    await page.click('button:has-text("[ CREATE ]")');

    // Room should appear in list
    await expect(page.locator(`text=${roomName}`)).toBeVisible();
  });
});

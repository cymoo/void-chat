import { test, expect } from "@playwright/test";

// Helper to register, create a room, and join it
async function setupChatRoom(page: import("@playwright/test").Page) {
  await page.goto("/auth");
  await page.click("text=[ REGISTER ]");
  const timestamp = Date.now();
  const username = `chattest_${timestamp}`;
  await page.fill('[placeholder="choose username..."]', username);
  await page.fill('[placeholder="choose password (min 6 chars)..."]', "password123");
  await page.fill('[placeholder="confirm password..."]', "password123");
  await page.click('button:has-text("[ CREATE ACCOUNT ]")');
  await expect(page).toHaveURL(/\/lobby/);

  // Create a room
  await page.click("text=[ + NEW ROOM ]");
  const roomName = `ChatRoom_${timestamp}`;
  await page.fill('[placeholder="enter room name..."]', roomName);
  await page.click('button:has-text("[ CREATE ]")');

  // Join the room
  await page.click(`text=${roomName}`);
  await expect(page).toHaveURL(/\/chat\/\d+/);

  return { username, roomName };
}

test.describe("Chat", () => {
  test("should join a room and see chat interface", async ({ page }) => {
    const { roomName } = await setupChatRoom(page);

    // Should see the chat header with room name
    await expect(page.locator(`text=#${roomName}`)).toBeVisible();

    // Should see the message input
    await expect(page.locator('[placeholder="type a message..."]')).toBeVisible();

    // Should see the user sidebar with ONLINE heading
    await expect(page.locator("text=ONLINE")).toBeVisible();
  });

  test("should send a text message", async ({ page }) => {
    const { username } = await setupChatRoom(page);

    // Type and send a message
    const messageText = `Hello from test ${Date.now()}`;
    await page.fill('[placeholder="type a message..."]', messageText);
    await page.keyboard.press("Enter");

    // Should see the message appear
    await expect(page.locator(`text=${messageText}`)).toBeVisible({ timeout: 5000 });
  });

  test("should leave room and return to lobby", async ({ page }) => {
    await setupChatRoom(page);

    // Click exit button
    await page.click("text=< EXIT");

    // Should be back in lobby
    await expect(page).toHaveURL(/\/lobby/);
    await expect(page.locator("text=AVAILABLE ROOMS")).toBeVisible();
  });
});

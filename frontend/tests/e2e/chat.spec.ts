import { test, expect, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

async function registerUser(page: Page, username: string, password = "password123") {
  await page.goto("/#/auth");
  await page.getByRole("button", { name: "REGISTER" }).click();
  const form = page.locator("form.auth-form.active");
  await form.locator('input[placeholder="anonymous"]').fill(username);
  await form.locator('input[autocomplete="new-password"]').first().fill(password);
  await form.locator('input[autocomplete="new-password"]').nth(1).fill(password);
  await form.locator("button.connect-btn").click();
  await expect(page).toHaveURL(/#\/lobby/);
}

async function createRoomAndEnter(page: Page, roomName: string) {
  await page.getByRole("button", { name: /NEW ROOM/i }).click();
  await page.locator('input[placeholder="my-awesome-room"]').fill(roomName);
  await page.getByRole("button", { name: /CREATE ROOM/i }).click();
  await expect(page).toHaveURL(/#\/chat\/\d+/);
}

async function openDm(page: Page, username: string) {
  const userItem = page.locator(".user-item", { hasText: username }).first();
  await expect(userItem).toBeVisible();
  await userItem.locator(".dm-btn").click();
  await expect(page.locator(".private-chat-panel")).toBeVisible();
}

async function setupTwoUsers(browser: Browser) {
  const id = randomUUID().slice(0, 8);
  const roomName = `room_${id}`;
  const userA = `chat_a_${id}`;
  const userB = `chat_b_${id}`;

  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await registerUser(pageA, userA);
  await createRoomAndEnter(pageA, roomName);
  const roomPath = pageA.url().split("#")[1] ?? "";

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await registerUser(pageB, userB);
  await pageB.goto(`/#${roomPath}`);
  await expect(pageB).toHaveURL(/#\/chat\/\d+/);

  await expect(pageA.locator(".user-item", { hasText: userB }).first()).toBeVisible();
  await expect(pageB.locator(".user-item", { hasText: userA }).first()).toBeVisible();

  return { contextA, contextB, pageA, pageB, userA, userB };
}

test.describe("Chat", () => {
  test("should not emit websocket pre-connect close warning when entering room", async ({ page }) => {
    const logs: string[] = [];
    page.on("console", (msg) => {
      logs.push(msg.text());
    });

    const id = randomUUID().slice(0, 8);
    await registerUser(page, `ws_user_${id}`);
    await createRoomAndEnter(page, `ws_room_${id}`);

    await expect(page.locator(".chat-layout")).toBeVisible();
    await page.waitForTimeout(500);
    expect(
      logs.some((line) =>
        line.includes("WebSocket is closed before the connection is established"),
      ),
    ).toBe(false);
  });

  test("should delete message and clear reply preview without duplicate-key warning", async ({ browser }) => {
    const { contextA, contextB, pageA, pageB } = await setupTwoUsers(browser);
    const logsA: string[] = [];
    const logsB: string[] = [];
    pageA.on("console", (msg) => logsA.push(msg.text()));
    pageB.on("console", (msg) => logsB.push(msg.text()));

    const rootMessage = `root_${Date.now()}`;
    await pageA.locator('textarea[placeholder^="Type message"]').fill(rootMessage);
    await pageA.keyboard.press("Enter");
    await expect(pageB.locator(".message-text", { hasText: rootMessage }).first()).toBeVisible();

    const target = pageA.locator(".message", { hasText: rootMessage }).first();
    await target.hover();
    const replyBtn = target.locator(".msg-action-reply");
    await expect(replyBtn).toBeVisible();
    await replyBtn.click();
    const roomInputA = pageA.locator('textarea[placeholder^="Type message"]');
    await roomInputA.fill(`reply_${Date.now()}`);
    await roomInputA.press("Enter");
    await expect(pageA.locator(".reply-preview").first()).toBeVisible();

    pageA.once("dialog", async (dialog) => dialog.accept());
    const msgOnA = pageA.locator(".message", { hasText: rootMessage }).first();
    await msgOnA.hover();
    await msgOnA.locator(".msg-action-delete").click({ force: true });

    await expect(pageA.locator(".message-text", { hasText: rootMessage })).toHaveCount(0);
    await expect(pageB.locator(".message-text", { hasText: rootMessage })).toHaveCount(0);
    await expect(pageA.locator(".reply-preview")).toHaveCount(0);
    await expect(pageB.locator(".reply-preview")).toHaveCount(0);

    expect(logsA.some((line) => line.includes("same key"))).toBe(false);
    expect(logsB.some((line) => line.includes("same key"))).toBe(false);

    await contextA.close();
    await contextB.close();
  });

  test("private chat should support multiline markdown and uploads", async ({ browser }) => {
    const { contextA, contextB, pageA, pageB, userA, userB } = await setupTwoUsers(browser);

    await openDm(pageA, userB);
    await openDm(pageB, userA);

    const dmInputA = pageA.locator('textarea[placeholder^="Type private message"]');
    await dmInputA.fill("**bold** line 1\nline 2");
    await dmInputA.press("Enter");

    const dmPanelA = pageA.locator(".private-chat-messages");
    const dmPanelB = pageB.locator(".private-chat-messages");
    await expect(dmPanelB.locator("strong", { hasText: "bold" })).toBeVisible();
    await expect(dmPanelB.locator("text=line 2")).toBeVisible();

    const imageUploadPromise = pageA.waitForResponse((res) => res.url().includes("/api/upload/image"));
    await pageA.locator('.private-chat-input label[title="Upload Image"] input[type="file"]').setInputFiles({
      name: "sample.png",
      mimeType: "image/png",
      buffer: Buffer.from("fake-image"),
    });
    expect((await imageUploadPromise).ok()).toBeTruthy();

    const fileUploadPromise = pageA.waitForResponse((res) => res.url().includes("/api/upload/file"));
    await pageA.locator('.private-chat-input label[title="Upload File"] input[type="file"]').setInputFiles({
      name: "sample.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello world"),
    });
    expect((await fileUploadPromise).ok()).toBeTruthy();
    await pageA.waitForTimeout(300);
    await expect(pageA.locator(".toast.error")).toHaveCount(0);

    await contextA.close();
    await contextB.close();
  });
});

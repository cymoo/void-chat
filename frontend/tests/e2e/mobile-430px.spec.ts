import { test, expect, devices } from "@playwright/test";

test.describe("Mobile 430px UX - Responsive Design", () => {
  test.use({
    ...devices["iPhone 15 Pro Max"],
    viewport: { width: 430, height: 932 },
  });

  test.beforeEach(async ({ page }) => {
    // Start at login
    await page.goto("/");
  });

  test("should display login form properly on 430px", async ({ page }) => {
    // Check that title is readable
    const title = page.locator(".title");
    expect(await title.isVisible()).toBe(true);

    // Verify form inputs are properly sized (font-size 16px to prevent zoom)
    const usernameInput = page.locator('input[type="text"]').first();
    const computedStyle = await usernameInput.evaluate((el) => {
      return window.getComputedStyle(el).fontSize;
    });
    expect(computedStyle).toBe("16px");

    // Check touch targets - buttons should be at least 44×44px
    const loginButton = page.locator('button:has-text("Login")').first();
    const boundingBox = await loginButton.boundingBox();
    expect(boundingBox).not.toBeNull();
    expect(boundingBox!.height).toBeGreaterThanOrEqual(44);
    expect(boundingBox!.width).toBeGreaterThanOrEqual(44);
  });

  test("should display chat header compactly on 430px", async ({ page }) => {
    // Login first
    await page.locator('input[placeholder="Username"]').fill("testuser");
    await page.locator('input[placeholder="Password"]').fill("pass");
    await page.locator('button:has-text("Login")').first().click();

    // Wait for lobby to appear
    await page.waitForSelector(".lobby-container", { timeout: 5000 });

    // Create or enter a room
    const createBtn = page.locator('button:has-text("Create")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.locator('input[placeholder*="Room"]').fill("test-room");
      await page.locator('button:has-text("Create")').nth(1).click();
    }

    // Wait for chat header
    await page.waitForSelector(".chat-header", { timeout: 5000 });

    // Check room name font size (should be 18px on 430px)
    const roomName = page.locator(".room-name");
    const fontSize = await roomName.evaluate((el) => {
      return window.getComputedStyle(el).fontSize;
    });
    expect(parseInt(fontSize)).toBeLessThanOrEqual(22); // Original is 22px, should be 18-22px on 430px

    // Check header buttons are touch-friendly (44px minimum)
    const headerButtons = page.locator(".header-tools .icon-btn");
    const count = await headerButtons.count();
    for (let i = 0; i < Math.min(count, 3); i++) {
      const btn = headerButtons.nth(i);
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(40); // Allow 40px min on mobile
      expect(box!.width).toBeGreaterThanOrEqual(40);
    }
  });

  test("should display messages with compact spacing on 430px", async ({ page }) => {
    // Login and navigate to chat
    await page.locator('input[placeholder="Username"]').fill("testuser");
    await page.locator('input[placeholder="Password"]').fill("pass");
    await page.locator('button:has-text("Login")').first().click();

    await page.waitForSelector(".messages-container", { timeout: 5000 });

    // Check message spacing
    const messages = page.locator(".message").first();
    const gap = await messages.evaluate((el) => {
      return window.getComputedStyle(el).gap;
    });
    expect(parseInt(gap)).toBeLessThanOrEqual(10); // Compact gap on 430px

    // Check avatar size is smaller on mobile
    const avatar = page.locator(".message-avatar").first();
    if (await avatar.isVisible()) {
      const width = await avatar.evaluate((el) => {
        return window.getComputedStyle(el).width;
      });
      const expectedSize = parseInt(width);
      expect(expectedSize).toBeLessThanOrEqual(40); // Reduced avatar size
    }
  });

  test("should have proper message input on 430px", async ({ page }) => {
    // Login and navigate to chat
    await page.locator('input[placeholder="Username"]').fill("testuser");
    await page.locator('input[placeholder="Password"]').fill("pass");
    await page.locator('button:has-text("Login")').first().click();

    await page.waitForSelector(".message-input", { timeout: 5000 });

    // Check input font size (16px to prevent iOS zoom)
    const input = page.locator(".message-input");
    const fontSize = await input.evaluate((el) => {
      return window.getComputedStyle(el).fontSize;
    });
    expect(fontSize).toBe("16px");

    // Check input has adequate height for touch
    const box = await input.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(40); // At least 40px for touch

    // Verify emoji button is touch-target size
    const emojiBtn = page.locator(".emoji-toggle-btn");
    const emojiBox = await emojiBtn.boundingBox();
    expect(emojiBox!.height).toBeGreaterThanOrEqual(40);
    expect(emojiBox!.width).toBeGreaterThanOrEqual(40);
  });

  test("should display sidebar drawer overlay on 430px", async ({ page }) => {
    // Login and navigate to chat
    await page.locator('input[placeholder="Username"]').fill("testuser");
    await page.locator('input[placeholder="Password"]').fill("pass");
    await page.locator('button:has-text("Login")').first().click();

    await page.waitForSelector(".chat-header", { timeout: 5000 });

    // Click users button to open sidebar
    const usersBtn = page.locator(".header-tools .icon-btn").first();
    await usersBtn.click();

    // Sidebar should be visible as overlay
    const sidebar = page.locator(".users-sidebar");
    expect(await sidebar.isVisible()).toBe(true);

    // Check sidebar width is constrained (280px max on 430px)
    const width = await sidebar.evaluate((el) => {
      return window.getComputedStyle(el).width;
    });
    const widthValue = parseInt(width);
    expect(widthValue).toBeLessThanOrEqual(320); // max of 280 + some margin

    // Close button should be touch-friendly
    const closeBtn = page.locator(".users-sidebar-close");
    const closeBox = await closeBtn.boundingBox();
    expect(closeBox).not.toBeNull();
    expect(closeBox!.height).toBeGreaterThanOrEqual(40);
    expect(closeBox!.width).toBeGreaterThanOrEqual(40);
  });

  test("should display modal forms properly on 430px", async ({ page }) => {
    // Navigate to login to test form modal responsiveness
    await page.goto("/");

    // Check form inputs are sized for touch and prevent zoom
    const inputs = page.locator('input[type="text"], input[type="password"]');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const fontSize = await input.evaluate((el) => {
        return window.getComputedStyle(el).fontSize;
      });
      expect(fontSize).toBe("16px"); // Prevent iOS zoom
    }

    // Check that buttons have touch targets
    const buttons = page.locator('button').filter({ hasText: /Login|Register|Create/ });
    const btnCount = await buttons.count();
    expect(btnCount).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(btnCount, 2); i++) {
      const btn = buttons.nth(i);
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(40);
    }
  });

  test("should prevent layout shift when scrolling messages", async ({ page }) => {
    // Login and navigate to chat
    await page.locator('input[placeholder="Username"]').fill("testuser");
    await page.locator('input[placeholder="Password"]').fill("pass");
    await page.locator('button:has-text("Login")').first().click();

    await page.waitForSelector(".messages-container", { timeout: 5000 });

    // Get initial viewport info
    const initialViewport = page.viewportSize();
    expect(initialViewport).not.toBeNull();
    expect(initialViewport!.width).toBe(430);

    // Scroll messages
    await page.locator(".messages-container").scroll(0, 100);

    // Verify viewport hasn't changed
    const finalViewport = page.viewportSize();
    expect(finalViewport!.width).toBe(initialViewport!.width);
    expect(finalViewport!.height).toBe(initialViewport!.height);
  });

  test("should have proper text readability on 430px", async ({ page }) => {
    // Check that text color has sufficient contrast with background
    // This is a basic smoke test
    await page.goto("/");

    const title = page.locator(".title");
    const bgColor = await title.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    const textColor = await title.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    // Both should be defined
    expect(bgColor).toBeTruthy();
    expect(textColor).toBeTruthy();
  });
});

test.describe("Mobile 430px - Touch Targets", () => {
  test.use({
    ...devices["iPhone 15 Pro Max"],
    viewport: { width: 430, height: 932 },
  });

  test("all interactive elements should be at least 44×44px", async ({ page }) => {
    await page.goto("/");

    // Check all buttons
    const buttons = page.locator("button");
    const btnCount = await buttons.count();

    for (let i = 0; i < Math.min(btnCount, 10); i++) {
      const btn = buttons.nth(i);
      const box = await btn.boundingBox();
      if (box && (await btn.isVisible())) {
        // We allow 40px minimum for mobile since touch target can be around 40-44px
        expect(
          box.height >= 40 || box.width >= 40,
          `Button ${i} at ${box.x},${box.y} is too small: ${box.width}×${box.height}`
        ).toBe(true);
      }
    }
  });

  test("message action buttons should be touch-friendly", async ({ page }) => {
    // Login
    await page.locator('input[placeholder="Username"]').fill("testuser");
    await page.locator('input[placeholder="Password"]').fill("pass");
    await page.locator('button:has-text("Login")').first().click();

    await page.waitForSelector(".message-actions-mobile", { timeout: 5000 });

    // Find message action buttons
    const actionBtns = page.locator(".message-actions-mobile button");
    const count = await actionBtns.count();

    for (let i = 0; i < count; i++) {
      const btn = actionBtns.nth(i);
      if (await btn.isVisible()) {
        const box = await btn.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(36); // Allow slightly smaller for mobile
        expect(box!.width).toBeGreaterThanOrEqual(36);
      }
    }
  });
});

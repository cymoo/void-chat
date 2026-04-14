import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  formatTime,
  formatDate,
  formatFileSize,
  getInitials,
  escapeHtml,
  formatRelativeTime,
} from "@/lib/utils";

describe("formatTime", () => {
  it("formats timestamp as YYYY-MM-DD HH:mm", () => {
    // Use a fixed UTC-based timestamp: 2024-03-15 10:05 local
    // We'll construct via Date to be timezone-agnostic
    const date = new Date(2024, 2, 15, 10, 5, 0); // March 15 2024 10:05:00 local
    const result = formatTime(date.getTime());
    expect(result).toBe("2024-03-15 10:05");
  });

  it("handles zero timestamp", () => {
    const result = formatTime(0);
    // Zero epoch = 1970-01-01 00:00 in UTC, but local tz may differ
    // Just verify format: YYYY-MM-DD HH:mm
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
});

describe("formatDate", () => {
  it("returns locale date string for timestamp", () => {
    const date = new Date(2024, 0, 1); // Jan 1 2024
    const result = formatDate(date.getTime());
    // toLocaleDateString output varies by locale/env; check it contains "2024"
    expect(result).toContain("2024");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("formatFileSize", () => {
  it("formats bytes as B", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1023)).toBe("1023 B");
  });

  it("formats KB", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(1024 * 1024 - 1)).toBe("1024.0 KB");
  });

  it("formats MB", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe("2.5 MB");
  });
});

describe("getInitials", () => {
  it("returns first 2 chars uppercased", () => {
    expect(getInitials("alice")).toBe("AL");
    expect(getInitials("bob")).toBe("BO");
    expect(getInitials("Charlie")).toBe("CH");
  });

  it("handles single char name", () => {
    expect(getInitials("X")).toBe("X");
  });

  it("handles empty string", () => {
    expect(getInitials("")).toBe("");
  });
});

describe("escapeHtml", () => {
  it("escapes < > & \" '", () => {
    const input = `<div class="test" data-x='y'>&amp;</div>`;
    const result = escapeHtml(input);
    expect(result).not.toContain("<div");
    expect(result).toContain("&lt;");
    expect(result).toContain("&gt;");
    expect(result).toContain("&amp;");
  });

  it("returns plain string unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
    expect(escapeHtml("no special chars 123")).toBe("no special chars 123");
  });
});

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for timestamps less than 60s ago", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    expect(formatRelativeTime(now - 30_000)).toBe("just now");
    expect(formatRelativeTime(now)).toBe("just now");
  });

  it("returns minutes for timestamps 1–59 minutes ago", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    expect(formatRelativeTime(now - 60_000)).toBe("1m ago");
    expect(formatRelativeTime(now - 5 * 60_000)).toBe("5m ago");
    expect(formatRelativeTime(now - 59 * 60_000)).toBe("59m ago");
  });

  it("returns hours for timestamps 1–23 hours ago", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    expect(formatRelativeTime(now - 3600_000)).toBe("1h ago");
    expect(formatRelativeTime(now - 23 * 3600_000)).toBe("23h ago");
  });

  it("returns days for timestamps 1–6 days ago", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    expect(formatRelativeTime(now - 24 * 3600_000)).toBe("1d ago");
    expect(formatRelativeTime(now - 6 * 24 * 3600_000)).toBe("6d ago");
  });

  it("falls back to formatTime for timestamps 7+ days ago", () => {
    const date = new Date(2024, 2, 1, 12, 0, 0); // March 1 2024 12:00
    vi.setSystemTime(new Date(2024, 2, 15)); // 14 days later
    const result = formatRelativeTime(date.getTime());
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
});

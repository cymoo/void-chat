import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Must import after mocking fetch
import * as client from "@/api/client";

function mockResponse(opts: {
  ok: boolean;
  status: number;
  json?: unknown;
  text?: string;
  contentType?: string;
}) {
  const rawText =
    opts.text ??
    (opts.json === undefined ? "" : JSON.stringify(opts.json));
  const response = {
    ok: opts.ok,
    status: opts.status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type"
          ? (opts.contentType ?? "application/json")
          : null,
    },
    json: () => Promise.resolve(opts.json),
    text: () => Promise.resolve(rawText),
    clone: () => response,
  };
  return response;
}

describe("API client", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorage.clear();
  });

  it("should include auth header when token is present", async () => {
    localStorage.setItem("authToken", "my-token");
    mockFetch.mockResolvedValue(
      mockResponse({ ok: true, status: 200, json: [] }),
    );

    await client.getRooms();

    expect(mockFetch).toHaveBeenCalledWith("/api/rooms", {
      method: "GET",
      headers: { Authorization: "Bearer my-token" },
      body: undefined,
    });
  });

  it("should not include auth header when no token", async () => {
    mockFetch.mockResolvedValue(
      mockResponse({ ok: true, status: 200, json: [] }),
    );

    await client.getRooms();

    expect(mockFetch).toHaveBeenCalledWith("/api/rooms", {
      method: "GET",
      headers: {},
      body: undefined,
    });
  });

  it("should send JSON body for POST requests", async () => {
    mockFetch.mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        json: {
          token: "t",
          user: { id: 1, username: "u", createdAt: 0, lastSeen: 0 },
        },
      }),
    );

    await client.login("user", "pass");

    expect(mockFetch).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "user", password: "pass" }),
    });
  });

  it("should send invite code for register when provided", async () => {
    mockFetch.mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        json: {
          token: "t",
          user: { id: 1, username: "u", createdAt: 0, lastSeen: 0 },
        },
      }),
    );

    await client.register("user", "pass123", "invite-code");

    expect(mockFetch).toHaveBeenCalledWith("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "user",
        password: "pass123",
        inviteCode: "invite-code",
      }),
    });
  });

  it("should send JSON body for room update PATCH requests", async () => {
    localStorage.setItem("authToken", "my-token");
    mockFetch.mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        json: {
          id: 1,
          name: "edited-room",
          description: "edited-desc",
          isPrivate: false,
          creatorId: 1,
          createdAt: 0,
          maxUsers: 100,
        },
      }),
    );

    await client.updateRoom(1, {
      name: "edited-room",
      description: "edited-desc",
      isPrivate: false,
      password: null,
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/rooms/1", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer my-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "edited-room",
        description: "edited-desc",
        isPrivate: false,
        password: null,
      }),
    });
  });

  it("should send username when updating profile", async () => {
    localStorage.setItem("authToken", "token");
    mockFetch.mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        json: {
          id: 1,
          username: "renamed",
          createdAt: 0,
          lastSeen: 0,
        },
      }),
    );

    await client.updateProfile({ username: "renamed", bio: "bio" });

    expect(mockFetch).toHaveBeenCalledWith("/api/users/me", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "renamed", bio: "bio" }),
    });
  });

  it("should throw ApiError on non-ok response", async () => {
    mockFetch.mockResolvedValue(
      mockResponse({
        ok: false,
        status: 401,
        json: { message: "Invalid credentials" },
      }),
    );

    await expect(client.login("bad", "wrong")).rejects.toThrow(
      "Username or password is incorrect",
    );
  });

  it("should return null for 204 responses", async () => {
    localStorage.setItem("authToken", "token");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
    });

    const result = await client.logout();
    expect(result).toBeNull();
  });

  it("should throw friendly error on non-JSON response", async () => {
    mockFetch.mockResolvedValue(
      mockResponse({
        ok: false,
        status: 502,
        text: "<html>bad gateway</html>",
        contentType: "text/html",
      }),
    );

    await expect(client.login("user", "pass")).rejects.toThrow(
      "Server error (502)",
    );
  });

  it("should surface plain text registration errors", async () => {
    mockFetch.mockResolvedValue(
      mockResponse({
        ok: false,
        status: 400,
        text: "Invalid invite code",
        contentType: "text/plain",
      }),
    );

    await expect(client.register("user", "pass123", "bad-code")).rejects.toThrow(
      "Invalid invite code",
    );
  });

  it("should throw network error when fetch fails", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(client.getRooms()).rejects.toThrow(
      "Network error",
    );
  });

  it("should request admin dashboard with auth header", async () => {
    localStorage.setItem("authToken", "admin-token");
    mockFetch.mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        json: {
          users: [],
          rooms: [],
        },
      }),
    );

    await client.getAdminDashboard();

    expect(mockFetch).toHaveBeenCalledWith("/api/admin/dashboard", {
      method: "GET",
      headers: { Authorization: "Bearer admin-token" },
      body: undefined,
    });
  });

  it("should send role update payload for admin user role change", async () => {
    localStorage.setItem("authToken", "admin-token");
    mockFetch.mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        json: {
          id: 3,
          username: "target",
          role: "platform_admin",
          createdAt: 0,
          lastSeen: 0,
        },
      }),
    );

    await client.updateAdminUserRole(3, "platform_admin");

    expect(mockFetch).toHaveBeenCalledWith("/api/admin/users/3/role", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer admin-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "platform_admin" }),
    });
  });

  it("should send disable payload for admin user moderation", async () => {
    localStorage.setItem("authToken", "admin-token");
    mockFetch.mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        json: {
          id: 3,
          username: "target",
          isDisabled: true,
          createdAt: 0,
          lastSeen: 0,
        },
      }),
    );

    await client.updateAdminUserDisabled(3, true, "abuse");

    expect(mockFetch).toHaveBeenCalledWith("/api/admin/users/3/disable", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer admin-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ disabled: true, reason: "abuse" }),
    });
  });

  it("should send mute payload for admin user moderation", async () => {
    localStorage.setItem("authToken", "admin-token");
    mockFetch.mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        json: {
          id: 3,
          username: "target",
          isMuted: true,
          mutedUntil: Date.now() + 60_000,
          createdAt: 0,
          lastSeen: 0,
        },
      }),
    );

    await client.updateAdminUserMute(3, true, 60, "spam");

    expect(mockFetch).toHaveBeenCalledWith("/api/admin/users/3/mute", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer admin-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ muted: true, durationMinutes: 60, reason: "spam" }),
    });
  });

  it("should create invite link via admin API", async () => {
    localStorage.setItem("authToken", "admin-token");
    mockFetch.mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        json: {
          code: "invite-code",
          invite: {
            id: 1,
            codePreview: "invite...",
            createdByUserId: 1,
            usedCount: 0,
            isActive: true,
            createdAt: 0,
          },
        },
      }),
    );

    await client.createAdminInvite(5, 24);

    expect(mockFetch).toHaveBeenCalledWith("/api/admin/invites", {
      method: "POST",
      headers: {
        Authorization: "Bearer admin-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ maxUses: 5, expiresInHours: 24 }),
    });
  });

  it("should revoke invite link via admin API", async () => {
    localStorage.setItem("authToken", "admin-token");
    mockFetch.mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        json: {
          id: 1,
          codePreview: "invite...",
          createdByUserId: 1,
          usedCount: 0,
          isActive: false,
          createdAt: 0,
        },
      }),
    );

    await client.revokeAdminInvite(1);

    expect(mockFetch).toHaveBeenCalledWith("/api/admin/invites/1/revoke", {
      method: "PATCH",
      headers: { Authorization: "Bearer admin-token" },
      body: undefined,
    });
  });

  it("should update registration mode via admin API", async () => {
    localStorage.setItem("authToken", "admin-token");
    mockFetch.mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        json: { mode: "invite_only" },
      }),
    );

    await client.updateRegistrationMode("invite_only");

    expect(mockFetch).toHaveBeenCalledWith("/api/admin/registration-mode", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer admin-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "invite_only" }),
    });
  });

  it("should fetch public registration mode", async () => {
    mockFetch.mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        json: { mode: "open" },
      }),
    );

    await client.getRegistrationMode();

    expect(mockFetch).toHaveBeenCalledWith("/api/auth/registration-mode", {
      method: "GET",
      headers: {},
      body: undefined,
    });
  });

  it("should fetch dm inbox entries", async () => {
    localStorage.setItem("authToken", "auth-token");
    mockFetch.mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        json: [
          { userId: 2, username: "alice", unreadCount: 3 },
          { userId: 3, username: "bob", unreadCount: 0 },
        ],
      }),
    );

    const inbox = await client.getDmInbox();

    expect(inbox).toEqual([
      { userId: 2, username: "alice", avatarUrl: null, unreadCount: 3 },
      { userId: 3, username: "bob", avatarUrl: null, unreadCount: 0 },
    ]);
    expect(mockFetch).toHaveBeenCalledWith("/api/dms/inbox", {
      method: "GET",
      headers: { Authorization: "Bearer auth-token" },
      body: undefined,
    });
  });
});

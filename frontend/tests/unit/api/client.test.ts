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
  contentType?: string;
}) {
  return {
    ok: opts.ok,
    status: opts.status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type"
          ? (opts.contentType ?? "application/json")
          : null,
    },
    json: () => Promise.resolve(opts.json),
  };
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
        contentType: "text/html",
      }),
    );

    await expect(client.login("user", "pass")).rejects.toThrow(
      "Server error (502)",
    );
  });

  it("should throw network error when fetch fails", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(client.getRooms()).rejects.toThrow(
      "Network error",
    );
  });
});

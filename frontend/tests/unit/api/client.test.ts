import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Must import after mocking fetch
import * as client from "@/api/client";

describe("API client", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorage.clear();
  });

  it("should include auth header when token is present", async () => {
    localStorage.setItem("authToken", "my-token");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    });

    await client.getRooms();

    expect(mockFetch).toHaveBeenCalledWith("/api/rooms", {
      method: "GET",
      headers: { Authorization: "Bearer my-token" },
      body: undefined,
    });
  });

  it("should not include auth header when no token", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    });

    await client.getRooms();

    expect(mockFetch).toHaveBeenCalledWith("/api/rooms", {
      method: "GET",
      headers: {},
      body: undefined,
    });
  });

  it("should send JSON body for POST requests", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          token: "t",
          user: { id: 1, username: "u", createdAt: 0, lastSeen: 0 },
        }),
    });

    await client.login("user", "pass");

    expect(mockFetch).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "user", password: "pass" }),
    });
  });

  it("should throw ApiError on non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: "Invalid credentials" }),
    });

    await expect(client.login("bad", "wrong")).rejects.toThrow(
      "Invalid credentials",
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
});

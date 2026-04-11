import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore } from "@/stores/authStore";

// Mock the API client
vi.mock("@/api/client", () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
}));

import * as api from "@/api/client";

describe("authStore", () => {
  beforeEach(() => {
    // Reset store state
    useAuthStore.setState({
      token: null,
      user: null,
      loading: false,
      error: null,
    });
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("should start with null token and user", () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.loading).toBe(false);
  });

  it("should login successfully", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      createdAt: Date.now(),
      lastSeen: Date.now(),
    };
    vi.mocked(api.login).mockResolvedValue({
      token: "test-token",
      user: mockUser,
    });

    await useAuthStore.getState().login("testuser", "password");

    const state = useAuthStore.getState();
    expect(state.token).toBe("test-token");
    expect(state.user).toEqual(mockUser);
    expect(state.loading).toBe(false);
    expect(localStorage.getItem("authToken")).toBe("test-token");
  });

  it("should handle login failure", async () => {
    vi.mocked(api.login).mockRejectedValue(new Error("Invalid credentials"));

    await expect(
      useAuthStore.getState().login("bad", "wrong"),
    ).rejects.toThrow("Invalid credentials");

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.error).toBe("Invalid credentials");
  });

  it("should register successfully", async () => {
    const mockUser = {
      id: 2,
      username: "newuser",
      createdAt: Date.now(),
      lastSeen: Date.now(),
    };
    vi.mocked(api.register).mockResolvedValue({
      token: "new-token",
      user: mockUser,
    });

    await useAuthStore.getState().register("newuser", "password123");

    const state = useAuthStore.getState();
    expect(state.token).toBe("new-token");
    expect(state.user).toEqual(mockUser);
  });

  it("should pass invite code to register api", async () => {
    const mockUser = {
      id: 2,
      username: "newuser",
      createdAt: Date.now(),
      lastSeen: Date.now(),
    };
    vi.mocked(api.register).mockResolvedValue({
      token: "new-token",
      user: mockUser,
    });

    await useAuthStore.getState().register("newuser", "password123", "invite-123");

    expect(api.register).toHaveBeenCalledWith(
      "newuser",
      "password123",
      "invite-123",
    );
  });

  it("should logout and clear state", async () => {
    // Set initial authenticated state
    useAuthStore.setState({
      token: "test-token",
      user: { id: 1, username: "test", createdAt: 0, lastSeen: 0 },
    });
    localStorage.setItem("authToken", "test-token");

    vi.mocked(api.logout).mockResolvedValue(undefined);

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(localStorage.getItem("authToken")).toBeNull();
  });

  it("should check auth with valid token", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      createdAt: Date.now(),
      lastSeen: Date.now(),
    };
    useAuthStore.setState({ token: "valid-token" });
    vi.mocked(api.getMe).mockResolvedValue(mockUser);

    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.loading).toBe(false);
  });

  it("should clear auth on invalid token", async () => {
    useAuthStore.setState({ token: "expired-token" });
    localStorage.setItem("authToken", "expired-token");
    vi.mocked(api.getMe).mockRejectedValue(new Error("Unauthorized"));

    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
  });
});

import { create } from "zustand";
import type { User } from "@/api/types";
import * as api from "@/api/client";

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  /** True once the initial checkAuth call has resolved (success or failure). */
  authChecked: boolean;

  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, inviteCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  updateUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem("authToken"),
  user: JSON.parse(localStorage.getItem("currentUser") ?? "null"),
  loading: false,
  error: null,
  authChecked: !localStorage.getItem("authToken"),

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const data = await api.login(username, password);
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("currentUser", JSON.stringify(data.user));
      set({ token: data.token, user: data.user, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Login failed" });
      throw e;
    }
  },

  register: async (username, password, inviteCode) => {
    set({ loading: true, error: null });
    try {
      const data = await api.register(username, password, inviteCode);
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("currentUser", JSON.stringify(data.user));
      set({ token: data.token, user: data.user, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Registration failed" });
      throw e;
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUser");
    set({ token: null, user: null });
  },

  checkAuth: async () => {
    const { token } = get();
    if (!token) {
      set({ authChecked: true });
      return;
    }
    set({ loading: true });
    try {
      const user = await api.getMe();
      localStorage.setItem("currentUser", JSON.stringify(user));
      set({ user, loading: false, authChecked: true });
    } catch {
      localStorage.removeItem("authToken");
      localStorage.removeItem("currentUser");
      set({ token: null, user: null, loading: false, authChecked: true });
    }
  },

  clearError: () => set({ error: null }),

  updateUser: (user) => {
    localStorage.setItem("currentUser", JSON.stringify(user));
    set({ user });
  },
}));

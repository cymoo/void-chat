import { useState, type FormEvent } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const addToast = useUiStore((s) => s.addToast);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      addToast("Please fill in all fields", "error");
      return;
    }
    try {
      await login(username.trim(), password);
      addToast(`Welcome back, ${username}`, "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Login failed", "error");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-terminal-green text-xs mb-1">
          USERNAME:
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-terminal-bg border border-terminal-border px-3 py-2 text-terminal-text font-mono text-sm focus:border-terminal-green focus:outline-none"
          placeholder="enter username..."
          autoComplete="username"
        />
      </div>
      <div>
        <label className="block text-terminal-green text-xs mb-1">
          PASSWORD:
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-terminal-bg border border-terminal-border px-3 py-2 text-terminal-text font-mono text-sm focus:border-terminal-green focus:outline-none"
          placeholder="enter password..."
          autoComplete="current-password"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full border border-terminal-green text-terminal-green px-4 py-2 font-mono text-sm hover:bg-terminal-green hover:text-terminal-bg transition-colors disabled:opacity-50"
      >
        {loading ? "AUTHENTICATING..." : "[ LOGIN ]"}
      </button>
    </form>
  );
}

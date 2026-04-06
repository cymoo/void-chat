import { useState, type FormEvent } from "react";
import { useAuthStore } from "@/stores/authStore";

export function AuthPage() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [statusText, setStatusText] = useState("SYSTEM READY");
  const [statusError, setStatusError] = useState(false);

  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const loading = useAuthStore((s) => s.loading);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setStatusText("AUTHENTICATING...");
    setStatusError(false);
    try {
      await login(loginUsername, loginPassword);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setStatusText(`[ERR] ${msg}`);
      setStatusError(true);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (regPassword !== regConfirm) {
      setStatusText("[ERR] Passwords do not match");
      setStatusError(true);
      return;
    }
    setStatusText("REGISTERING...");
    setStatusError(false);
    try {
      await register(regUsername, regPassword);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      setStatusText(`[ERR] ${msg}`);
      setStatusError(true);
    }
  };

  return (
    <div id="auth-screen" className="screen active">
      <div className="login-container">
        <div className="glitch-wrapper">
          <h1 className="title glitch" data-text="TERMINAL.CHAT">
            TERMINAL.CHAT
          </h1>
        </div>
        <div className="subtitle">/// ENTER THE VOID</div>

        <div className="auth-tabs">
          <button
            className={`auth-tab${tab === "login" ? " active" : ""}`}
            onClick={() => setTab("login")}
          >
            LOGIN
          </button>
          <button
            className={`auth-tab${tab === "register" ? " active" : ""}`}
            onClick={() => setTab("register")}
          >
            REGISTER
          </button>
        </div>

        {tab === "login" ? (
          <form className="auth-form active" onSubmit={handleLogin}>
            <div className="input-group">
              <label className="input-label">&gt; USERNAME</label>
              <input
                className="terminal-input"
                type="text"
                placeholder="anonymous"
                autoComplete="off"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="input-label">&gt; PASSWORD</label>
              <input
                className="terminal-input"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>
            <button className="connect-btn" type="submit" disabled={loading}>
              <span className="btn-text">LOGIN &gt;&gt;</span>
              <span className="btn-scan" />
            </button>
          </form>
        ) : (
          <form className="auth-form active" onSubmit={handleRegister}>
            <div className="input-group">
              <label className="input-label">&gt; USERNAME</label>
              <input
                className="terminal-input"
                type="text"
                placeholder="anonymous"
                autoComplete="off"
                required
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="input-label">&gt; PASSWORD</label>
              <input
                className="terminal-input"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                required
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="input-label">&gt; CONFIRM PASSWORD</label>
              <input
                className="terminal-input"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                required
                value={regConfirm}
                onChange={(e) => setRegConfirm(e.target.value)}
              />
            </div>
            <button className="connect-btn" type="submit" disabled={loading}>
              <span className="btn-text">REGISTER &gt;&gt;</span>
              <span className="btn-scan" />
            </button>
          </form>
        )}

        <div className="login-footer">
          <div className="status-bar">
            <span className="status-indicator" />
            <span
              className="status-text"
              style={statusError ? { color: "var(--color-warning)" } : undefined}
            >
              {statusText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

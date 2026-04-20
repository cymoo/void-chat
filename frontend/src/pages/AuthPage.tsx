import { useEffect, useState, type FormEvent } from "react";
import * as api from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";

export function AuthPage() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [registrationMode, setRegistrationMode] = useState<"open" | "invite_only">("open");
  const [statusText, setStatusText] = useState("SYSTEM READY");
  const [statusError, setStatusError] = useState(false);

  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const loading = useAuthStore((s) => s.loading);
  const addToast = useUiStore((s) => s.addToast);

  useEffect(() => {
    let active = true;
    const loadMode = async () => {
      try {
        const result = await api.getRegistrationMode();
        if (active) {
          setRegistrationMode(result.mode);
        }
      } catch {
        if (active) {
          setRegistrationMode("open");
        }
      }
    };
    void loadMode();
    return () => {
      active = false;
    };
  }, []);

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
      addToast(msg, "error");
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (regPassword !== regConfirm) {
      setStatusText("[ERR] Passwords do not match");
      setStatusError(true);
      return;
    }
    if (registrationMode === "invite_only" && inviteCode.trim().length === 0) {
      setStatusText("[ERR] Invite code is required");
      setStatusError(true);
      return;
    }
    setStatusText("REGISTERING...");
    setStatusError(false);
    try {
      await register(regUsername, regPassword, inviteCode.trim() || undefined);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      setStatusText(`[ERR] ${msg}`);
      setStatusError(true);
      addToast(msg, "error");
    }
  };

  return (
    <div id="auth-screen" className="screen active">
      <div className="login-container">
        <div className="glitch-wrapper">
          <h1 className="title glitch" data-text="VOID.CHAT">
            VOID.CHAT
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

        <div className="auth-mode-hint">
          REGISTRATION MODE: {registrationMode === "invite_only" ? "INVITE ONLY" : "OPEN"}
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
              {regConfirm.length > 0 && regPassword !== regConfirm && (
                <span className="field-error">Passwords do not match</span>
              )}
            </div>
            <div className="input-group">
              <label className="input-label">
                &gt; INVITE CODE {registrationMode === "invite_only" ? "(REQUIRED)" : "(OPTIONAL)"}
              </label>
              <input
                className="terminal-input"
                type="text"
                placeholder="INVITE-XXXX"
                autoComplete="off"
                required={registrationMode === "invite_only"}
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
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

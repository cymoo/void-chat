import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { AuthPage } from "@/pages/AuthPage";
import { LobbyPage } from "@/pages/LobbyPage";
import { ChatPage } from "@/pages/ChatPage";
import { AdminPage } from "@/pages/AdminPage";
import { MailboxPage } from "@/pages/MailboxPage";
import { ToastContainer } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ImageViewer } from "@/components/ui/ImageViewer";
import { MatrixRain } from "@/components/effects/MatrixRain";
import { Component, useEffect, type ReactNode } from "react";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-boundary-icon">⚠</div>
            <h1>SYSTEM ERROR</h1>
            <p>{this.state.error.message}</p>
            <button onClick={() => window.location.reload()}>RELOAD</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const authChecked = useAuthStore((s) => s.authChecked);
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const theme = useThemeStore((s) => s.theme);
  const isTerminal = theme === "terminal";
  const canAccessAdminDashboard = Boolean(
    user?.capabilities?.canAccessAdminDashboard ||
    user?.role === "platform_admin" ||
    user?.role === "super_admin",
  );

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <ErrorBoundary>
      {isTerminal && <MatrixRain />}
      {isTerminal && <div className="noise-overlay" />}
      {!authChecked ? (
        <div className="app-loading">
          <div className="matrix-loader">
            <div className="matrix-loader-text">AUTHENTICATING</div>
            <div className="matrix-loader-bar">
              <div className="matrix-loader-fill" />
            </div>
          </div>
        </div>
      ) : (
        <Routes>
          <Route
            path="/auth"
            element={token ? <Navigate to="/lobby" replace /> : <AuthPage />}
          />
          <Route
            path="/lobby"
            element={token ? <LobbyPage /> : <Navigate to="/auth" replace />}
          />
          <Route
            path="/chat/:roomId"
            element={token ? <ChatPage /> : <Navigate to="/auth" replace />}
          />
          <Route
            path="/mailbox"
            element={token ? <MailboxPage /> : <Navigate to="/auth" replace />}
          />
          <Route
            path="/admin"
            element={
              token ? (
                canAccessAdminDashboard ? (
                  <AdminPage />
                ) : (
                  <Navigate to="/lobby" replace />
                )
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />
          <Route
            path="*"
            element={<Navigate to={token ? "/lobby" : "/auth"} replace />}
          />
        </Routes>
      )}
      <ToastContainer />
      <ConfirmDialog />
      <ImageViewer />
    </ErrorBoundary>
  );
}

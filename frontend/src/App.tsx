import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { AuthPage } from "@/pages/AuthPage";
import { LobbyPage } from "@/pages/LobbyPage";
import { ChatPage } from "@/pages/ChatPage";
import { AdminPage } from "@/pages/AdminPage";
import { ToastContainer } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MatrixRain } from "@/components/effects/MatrixRain";
import { useEffect } from "react";

export function App() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const canAccessAdminDashboard = Boolean(
    user?.capabilities?.canAccessAdminDashboard ||
    user?.role === "platform_admin" ||
    user?.role === "super_admin",
  );

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <>
      <MatrixRain />
      <div className="noise-overlay" />
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
      <ToastContainer />
      <ConfirmDialog />
    </>
  );
}

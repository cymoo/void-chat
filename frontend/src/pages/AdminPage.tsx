import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import * as api from "@/api/client";
import { AdminUserModal } from "@/components/profile/AdminUserModal";
import { AdminOverviewTab } from "@/components/admin/AdminOverviewTab";
import { AdminUserManagementTab } from "@/components/admin/AdminUserManagementTab";
import { AdminRoomManagementTab } from "@/components/admin/AdminRoomManagementTab";
import { AdminControlTab } from "@/components/admin/AdminControlTab";
import type { AdminDashboardResponse, PersonaConfig, User } from "@/api/types";

const ADMIN_TABS = [
  { id: "overview", label: "OVERVIEW" },
  { id: "users", label: "USER MANAGEMENT" },
  { id: "rooms", label: "ROOM MANAGEMENT" },
  { id: "control", label: "ADMIN CONTROL" },
] as const;

type AdminTabId = (typeof ADMIN_TABS)[number]["id"];

export function AdminPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const addToast = useUiStore((s) => s.addToast);
  const confirm = useUiStore((s) => s.confirm);

  const [activeTab, setActiveTab] = useState<AdminTabId>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [personaConfigs, setPersonaConfigs] = useState<Record<number, PersonaConfig>>({});
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const canManagePlatformUsers = Boolean(
    currentUser?.capabilities?.canManagePlatformUsers ||
    currentUser?.role === "platform_admin" ||
    currentUser?.role === "super_admin",
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashData, personaList] = await Promise.all([
        api.getAdminDashboard(),
        api.listAdminPersonas().catch(() => [] as PersonaConfig[]),
      ]);
      setDashboard(dashData);
      setPersonaConfigs(Object.fromEntries(personaList.map((p) => [p.userId, p])));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load admin dashboard";
      setError(message);
      addToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const updateUserInDashboard = useCallback((updated: User) => {
    setDashboard((prev) =>
      prev ? { ...prev, users: prev.users.map((u) => (u.id === updated.id ? updated : u)) } : prev,
    );
  }, []);

  const handleUserSaved = useCallback(
    (updatedUser: User, updatedConfig?: PersonaConfig) => {
      updateUserInDashboard(updatedUser);
      if (updatedConfig) {
        setPersonaConfigs((prev) => ({ ...prev, [updatedConfig.userId]: updatedConfig }));
      }
      setEditingUser(null);
    },
    [updateUserInDashboard],
  );

  return (
    <div className="screen active">
      <div className="admin-dashboard-container">
        <div className="admin-dashboard-header">
          <div className="admin-dashboard-title">ADMIN DASHBOARD</div>
          <div className="admin-dashboard-actions">
            <button
              type="button"
              className="icon-btn lobby-action-btn"
              onClick={() => void loadDashboard()}
            >
              REFRESH
            </button>
            <button
              type="button"
              className="icon-btn lobby-action-btn"
              onClick={() => navigate("/lobby")}
            >
              BACK TO LOBBY
            </button>
          </div>
        </div>

        {loading ? (
          <div className="admin-dashboard-loading">LOADING ADMIN DATA...</div>
        ) : error ? (
          <div className="admin-dashboard-error">{error}</div>
        ) : dashboard ? (
          <div className="admin-dashboard-shell">
            <div className="admin-tabs" role="tablist" aria-label="Admin sections">
              {ADMIN_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`admin-tab-btn${activeTab === tab.id ? " active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="admin-tab-content" role="tabpanel">
              {activeTab === "overview" && <AdminOverviewTab dashboard={dashboard} />}
              {activeTab === "users" && (
                <AdminUserManagementTab
                  dashboard={dashboard}
                  currentUser={currentUser!}
                  canManagePlatformUsers={canManagePlatformUsers}
                  addToast={addToast}
                  confirm={confirm}
                  updateUserInDashboard={updateUserInDashboard}
                  setDashboard={setDashboard}
                  personaConfigs={personaConfigs}
                  onEditUser={setEditingUser}
                />
              )}
              {activeTab === "rooms" && <AdminRoomManagementTab dashboard={dashboard} />}
              {activeTab === "control" && (
                <AdminControlTab
                  dashboard={dashboard}
                  canManagePlatformUsers={canManagePlatformUsers}
                  addToast={addToast}
                  confirm={confirm}
                  setDashboard={setDashboard}
                />
              )}
            </div>
          </div>
        ) : null}
      </div>

      {editingUser && (
        <AdminUserModal
          user={editingUser}
          personaConfig={personaConfigs[editingUser.id]}
          onClose={() => setEditingUser(null)}
          onSaved={handleUserSaved}
        />
      )}
    </div>
  );
}

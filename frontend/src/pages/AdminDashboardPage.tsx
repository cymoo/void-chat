import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import * as api from "@/api/client";
import { formatDate } from "@/lib/utils";
import type { AdminDashboardResponse, User } from "@/api/types";

const PLATFORM_ROLE_OPTIONS = ["user", "platform_admin", "super_admin"] as const;

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const addToast = useUiStore((s) => s.addToast);

  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<number, string>>({});

  const canManagePlatformUsers = Boolean(
    currentUser?.capabilities?.canManagePlatformUsers ||
      currentUser?.role === "platform_admin" ||
      currentUser?.role === "super_admin",
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAdminDashboard();
      setDashboard(data);
      setRoleDrafts(
        Object.fromEntries(data.users.map((u) => [u.id, u.role ?? "user"])),
      );
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to load admin dashboard";
      setError(message);
      addToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const users = useMemo(() => dashboard?.users ?? [], [dashboard]);
  const rooms = useMemo(() => dashboard?.rooms ?? [], [dashboard]);

  const saveRole = async (user: User) => {
    const nextRole = roleDrafts[user.id] ?? user.role ?? "user";
    if (nextRole === (user.role ?? "user")) return;
    setSavingUserId(user.id);
    try {
      const updated = await api.updateAdminUserRole(user.id, nextRole);
      setDashboard((prev) =>
        prev
          ? {
              ...prev,
              users: prev.users.map((u) => (u.id === user.id ? updated : u)),
            }
          : prev,
      );
      setRoleDrafts((prev) => ({ ...prev, [user.id]: updated.role ?? "user" }));
      addToast(`Updated role for ${updated.username}`, "success");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to update role";
      addToast(message, "error");
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <div className="screen active">
      <div className="admin-dashboard-container">
        <div className="admin-dashboard-header">
          <div>
            <div className="admin-dashboard-title">ADMIN DASHBOARD</div>
            <div className="admin-dashboard-subtitle">
              Platform roles, users, and room overview
            </div>
          </div>
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
        ) : (
          <div className="admin-dashboard-grid">
            <section className="admin-card">
              <h2 className="admin-card-title">PLATFORM USERS</h2>
              <div className="admin-users-table-wrap">
                <table className="admin-users-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Joined</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const currentRole = user.role ?? "user";
                      const draftRole = roleDrafts[user.id] ?? currentRole;
                      const changed = draftRole !== currentRole;
                      const isSelf = user.id === currentUser?.id;
                      return (
                        <tr key={user.id}>
                          <td>{user.username}</td>
                          <td>
                            <select
                              className="admin-role-select"
                              value={draftRole}
                              disabled={!canManagePlatformUsers || isSelf}
                              onChange={(e) =>
                                setRoleDrafts((prev) => ({
                                  ...prev,
                                  [user.id]: e.target.value,
                                }))
                              }
                            >
                              {PLATFORM_ROLE_OPTIONS.map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>{user.status ?? "-"}</td>
                          <td>{formatDate(user.createdAt)}</td>
                          <td>
                            <button
                              type="button"
                              className="admin-save-btn"
                              disabled={
                                !canManagePlatformUsers ||
                                !changed ||
                                isSelf ||
                                savingUserId === user.id
                              }
                              onClick={() => void saveRole(user)}
                            >
                              {savingUserId === user.id ? "SAVING..." : "SAVE"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="admin-card">
              <h2 className="admin-card-title">ROOMS OVERVIEW</h2>
              <div className="admin-room-list">
                {rooms.map((room) => (
                  <div key={room.id} className="admin-room-item">
                    <div className="admin-room-item-title">
                      {room.name}
                      {room.isPrivate && <span className="room-lock-icon">🔒</span>}
                    </div>
                    <div className="admin-room-item-meta">
                      <span>ONLINE: {room.onlineUsers}</span>
                      <span>MAX: {room.maxUsers}</span>
                      <span>CREATOR: {room.creatorId ?? "-"}</span>
                    </div>
                    {room.description && (
                      <div className="admin-room-item-description">
                        {room.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

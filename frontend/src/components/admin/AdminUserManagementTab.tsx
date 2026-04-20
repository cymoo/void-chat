import { useCallback, useMemo, useState } from "react";
import * as api from "@/api/client";
import { formatDate } from "@/lib/utils";
import type { PersonaConfig, User } from "@/api/types";
import type { AdminTabProps } from "./types";
import { isMutedUser } from "./types";

const ALL_ROLE_OPTIONS = ["user", "platform_admin", "super_admin", "bot"] as const;

type UserStateFilter = "all" | "active" | "muted" | "disabled";
type UserRoleFilter = "all" | "bot" | (typeof ALL_ROLE_OPTIONS)[number];

interface AdminUserManagementTabProps extends AdminTabProps {
  personaConfigs: Record<number, PersonaConfig>;
  onEditUser: (user: User) => void;
}

export function AdminUserManagementTab({
  dashboard,
  currentUser,
  canManagePlatformUsers,
  addToast,
  confirm,
  updateUserInDashboard,
  personaConfigs,
  onEditUser,
}: AdminUserManagementTabProps) {
  const users = useMemo(() => dashboard.users ?? [], [dashboard]);
  const [roleDrafts, setRoleDrafts] = useState<Record<number, string>>(
    () => Object.fromEntries(users.map((u) => [u.id, u.role ?? "user"])),
  );
  const [busyUserIds, setBusyUserIds] = useState<Record<number, boolean>>({});
  const [userQuery, setUserQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRoleFilter>("all");
  const [stateFilter, setStateFilter] = useState<UserStateFilter>("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const setUserBusy = useCallback((userId: number, busy: boolean) => {
    setBusyUserIds((prev) => {
      const next = { ...prev };
      if (busy) next[userId] = true;
      else delete next[userId];
      return next;
    });
  }, []);

  const filteredUsers = useMemo(() => {
    const query = userQuery.trim().toLowerCase();
    return users.filter((user) => {
      const role = user.role ?? "user";
      const disabled = Boolean(user.isDisabled);
      const muted = isMutedUser(user);
      const state = disabled ? "disabled" : muted ? "muted" : "active";
      const matchQuery = query.length === 0 || user.username.toLowerCase().includes(query);
      const matchRole = roleFilter === "all" || role === roleFilter;
      const matchState = stateFilter === "all" || stateFilter === state;
      return matchQuery && matchRole && matchState;
    });
  }, [roleFilter, stateFilter, userQuery, users]);

  // Reset page when filters change
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePageIndex = Math.min(page, totalPages - 1);
  const pagedUsers = filteredUsers.slice(safePageIndex * PAGE_SIZE, (safePageIndex + 1) * PAGE_SIZE);

  const handleRoleChange = useCallback(
    async (user: User, nextRole: string) => {
      const currentRole = user.role ?? "user";
      if (nextRole === currentRole) return;

      const confirmed = await confirm({
        title: "CHANGE ROLE",
        message: `Change ${user.username}'s role from ${currentRole} to ${nextRole}?`,
        confirmText: "CHANGE",
        cancelText: "CANCEL",
        tone: "danger",
      });
      if (!confirmed) {
        setRoleDrafts((prev) => ({ ...prev, [user.id]: currentRole }));
        return;
      }

      setUserBusy(user.id, true);
      try {
        const updated = await api.updateAdminUserRole(user.id, nextRole);
        updateUserInDashboard(updated);
        setRoleDrafts((prev) => ({ ...prev, [user.id]: updated.role ?? "user" }));
        addToast(`Updated role for ${updated.username}`, "success");
      } catch (e) {
        setRoleDrafts((prev) => ({ ...prev, [user.id]: currentRole }));
        const message = e instanceof Error ? e.message : "Failed to update role";
        addToast(message, "error");
      } finally {
        setUserBusy(user.id, false);
      }
    },
    [addToast, confirm, setUserBusy, updateUserInDashboard],
  );

  const toggleDisabled = useCallback(
    async (user: User) => {
      const nextDisabled = !user.isDisabled;
      const confirmed = await confirm({
        title: nextDisabled ? "DISABLE USER" : "ENABLE USER",
        message: nextDisabled
          ? `Disable ${user.username}? They will be unable to access the platform.`
          : `Enable ${user.username}?`,
        confirmText: nextDisabled ? "DISABLE" : "ENABLE",
        cancelText: "CANCEL",
        tone: "danger",
      });
      if (!confirmed) return;

      setUserBusy(user.id, true);
      try {
        const updated = await api.updateAdminUserDisabled(
          user.id,
          nextDisabled,
          nextDisabled ? "Disabled by admin" : undefined,
        );
        updateUserInDashboard(updated);
        addToast(
          `${updated.username} ${updated.isDisabled ? "disabled" : "enabled"}`,
          "success",
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to update user";
        addToast(message, "error");
      } finally {
        setUserBusy(user.id, false);
      }
    },
    [addToast, confirm, setUserBusy, updateUserInDashboard],
  );

  const toggleMuted = useCallback(
    async (user: User) => {
      const nextMuted = !isMutedUser(user);
      const confirmed = await confirm({
        title: nextMuted ? "MUTE USER" : "UNMUTE USER",
        message: nextMuted
          ? `Mute ${user.username} from room messaging for 60 minutes?`
          : `Unmute ${user.username}?`,
        confirmText: nextMuted ? "MUTE" : "UNMUTE",
        cancelText: "CANCEL",
        tone: "danger",
      });
      if (!confirmed) return;

      setUserBusy(user.id, true);
      try {
        const updated = await api.updateAdminUserMute(
          user.id,
          nextMuted,
          nextMuted ? 60 : undefined,
          nextMuted ? "Muted by admin" : undefined,
        );
        updateUserInDashboard(updated);
        addToast(
          `${updated.username} ${isMutedUser(updated) ? "muted" : "unmuted"}`,
          "success",
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to update user";
        addToast(message, "error");
      } finally {
        setUserBusy(user.id, false);
      }
    },
    [addToast, confirm, setUserBusy, updateUserInDashboard],
  );

  return (
    <section className="admin-card">
      <h2 className="admin-card-title">PLATFORM USERS</h2>
      <div className="admin-user-filters">
        <input
          className="terminal-input admin-filter-input"
          type="text"
          value={userQuery}
          placeholder="Search username..."
          onChange={(e) => { setUserQuery(e.target.value); setPage(0); }}
        />
        <select
          className="terminal-select admin-filter-select"
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value as UserRoleFilter); setPage(0); }}
        >
          <option value="all">All roles</option>
          <option value="user">user</option>
          <option value="platform_admin">platform_admin</option>
          <option value="super_admin">super_admin</option>
          <option value="bot">bot</option>
        </select>
        <select
          className="terminal-select admin-filter-select"
          value={stateFilter}
          onChange={(e) => { setStateFilter(e.target.value as UserStateFilter); setPage(0); }}
        >
          <option value="all">All states</option>
          <option value="active">active</option>
          <option value="muted">muted</option>
          <option value="disabled">disabled</option>
        </select>
        <span className="admin-filter-count">
          {filteredUsers.length} / {users.length}
        </span>
      </div>

      <div className="admin-users-table-wrap">
        <table className="admin-users-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Moderation</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td className="admin-empty-cell" colSpan={5}>
                  NO USERS MATCH CURRENT FILTERS
                </td>
              </tr>
            ) : (
              pagedUsers.map((user) => {
                const currentRole = user.role ?? "user";
                const isBot = currentRole === "bot";
                const draftRole = roleDrafts[user.id] ?? currentRole;
                const isSelf = user.id === currentUser?.id;
                const muted = isMutedUser(user);
                const disabled = Boolean(user.isDisabled);
                const busy = Boolean(busyUserIds[user.id]);
                const personaConfig = personaConfigs[user.id];
                return (
                  <tr key={user.id}>
                    <td>
                      <button
                        type="button"
                        className="admin-username-btn"
                        onClick={() => onEditUser(user)}
                      >
                        {isBot ? (
                          <>🤖 {personaConfig?.displayName ?? user.username}</>
                        ) : (
                          user.username
                        )}
                        {isBot && (
                          <span className="admin-username-sub">@{user.username}</span>
                        )}
                      </button>
                    </td>
                    <td>
                      <select
                        className="admin-role-select"
                        value={draftRole}
                        disabled={!canManagePlatformUsers || isSelf || busy}
                        onChange={(e) => {
                          const nextRole = e.target.value;
                          setRoleDrafts((prev) => ({ ...prev, [user.id]: nextRole }));
                          void handleRoleChange(user, nextRole);
                        }}
                      >
                        {ALL_ROLE_OPTIONS.map((role) => (
                          <option
                            key={role}
                            value={role}
                            disabled={isBot ? role !== "bot" : role === "bot"}
                          >
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span
                        className={`admin-state-badge ${
                          disabled ? "state-disabled" : muted ? "state-muted" : "state-active"
                        }`}
                      >
                        {disabled ? "DISABLED" : muted ? "MUTED" : "ACTIVE"}
                      </span>
                    </td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>
                      <div className="admin-row-actions">
                        <button
                          type="button"
                          className="admin-mini-btn"
                          disabled={!canManagePlatformUsers}
                          onClick={() => onEditUser(user)}
                        >
                          EDIT
                        </button>
                        {!isBot && (
                          <>
                            <button
                              type="button"
                              className="admin-mini-btn"
                              disabled={!canManagePlatformUsers || isSelf || busy || disabled}
                              onClick={() => void toggleMuted(user)}
                            >
                              {muted ? "UNMUTE" : "MUTE"}
                            </button>
                            <button
                              type="button"
                              className={`admin-mini-btn ${
                                disabled ? "admin-mini-btn-ok" : "admin-mini-btn-danger"
                              }`}
                              disabled={!canManagePlatformUsers || isSelf || busy}
                              onClick={() => void toggleDisabled(user)}
                            >
                              {disabled ? "ENABLE" : "DISABLE"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="admin-pagination">
          <button
            type="button"
            className="admin-mini-btn"
            disabled={safePageIndex === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            ← PREV
          </button>
          <span className="admin-page-info">
            PAGE {safePageIndex + 1} / {totalPages}
          </span>
          <button
            type="button"
            className="admin-mini-btn"
            disabled={safePageIndex >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            NEXT →
          </button>
        </div>
      )}
    </section>
  );
}

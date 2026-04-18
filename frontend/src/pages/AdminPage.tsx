import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import * as api from "@/api/client";
import { formatDate } from "@/lib/utils";
import { AdminUserModal } from "@/components/profile/AdminUserModal";
import type {
  AdminDashboardResponse,
  InviteLink,
  PersonaConfig,
  RegistrationMode,
  User,
} from "@/api/types";

const ALL_ROLE_OPTIONS = [
  "user",
  "platform_admin",
  "super_admin",
  "bot",
] as const;
const ADMIN_TABS = [
  { id: "overview", label: "OVERVIEW" },
  { id: "users", label: "USER MANAGEMENT" },
  { id: "rooms", label: "ROOM MANAGEMENT" },
  { id: "control", label: "ADMIN CONTROL" },
] as const;

type UserStateFilter = "all" | "active" | "muted" | "disabled";
type UserRoleFilter = "all" | "bot" | (typeof ALL_ROLE_OPTIONS)[number];
type AdminTabId = (typeof ADMIN_TABS)[number]["id"];

function isMutedUser(user: User): boolean {
  if (user.isMuted) return true;
  if (typeof user.mutedUntil !== "number") return false;
  return user.mutedUntil > Date.now();
}

function roomCapacityPercent(onlineUsers: number, maxUsers: number): number {
  if (!Number.isFinite(maxUsers) || maxUsers <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((onlineUsers / maxUsers) * 100)));
}

export function AdminPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const addToast = useUiStore((s) => s.addToast);
  const confirm = useUiStore((s) => s.confirm);

  const [activeTab, setActiveTab] = useState<AdminTabId>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(
    null,
  );
  const [roleDrafts, setRoleDrafts] = useState<Record<number, string>>({});
  const [busyUserIds, setBusyUserIds] = useState<Record<number, boolean>>({});
  const [userQuery, setUserQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRoleFilter>("all");
  const [stateFilter, setStateFilter] = useState<UserStateFilter>("all");

  const [inviteMaxUses, setInviteMaxUses] = useState("");
  const [inviteExpiresHours, setInviteExpiresHours] = useState("24");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [latestInviteCode, setLatestInviteCode] = useState<string | null>(null);
  const [updatingMode, setUpdatingMode] = useState(false);

  const [personaConfigs, setPersonaConfigs] = useState<Record<number, PersonaConfig>>({});
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const canManagePlatformUsers = Boolean(
    currentUser?.capabilities?.canManagePlatformUsers ||
    currentUser?.role === "platform_admin" ||
    currentUser?.role === "super_admin",
  );

  const setUserBusy = useCallback((userId: number, busy: boolean) => {
    setBusyUserIds((prev) => {
      const next = { ...prev };
      if (busy) {
        next[userId] = true;
      } else {
        delete next[userId];
      }
      return next;
    });
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashData, personaList] = await Promise.all([
        api.getAdminDashboard(),
        api.listAdminPersonas().catch(() => [] as PersonaConfig[]),
      ]);
      setDashboard(dashData);
      setRoleDrafts(
        Object.fromEntries(dashData.users.map((u) => [u.id, u.role ?? "user"])),
      );
      setPersonaConfigs(Object.fromEntries(personaList.map((p) => [p.userId, p])));
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
  const invites = useMemo(() => dashboard?.invites ?? [], [dashboard]);
  const rooms = useMemo(() => dashboard?.rooms ?? [], [dashboard]);
  const registrationMode = dashboard?.registrationMode ?? "open";

  const usersById = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users],
  );

  const filteredUsers = useMemo(() => {
    const query = userQuery.trim().toLowerCase();
    return users.filter((user) => {
      const role = user.role ?? "user";
      const disabled = Boolean(user.isDisabled);
      const muted = isMutedUser(user);
      const state = disabled ? "disabled" : muted ? "muted" : "active";
      const matchQuery =
        query.length === 0 || user.username.toLowerCase().includes(query);
      const matchRole = roleFilter === "all" || role === roleFilter;
      const matchState = stateFilter === "all" || stateFilter === state;
      return matchQuery && matchRole && matchState;
    });
  }, [roleFilter, stateFilter, userQuery, users]);

  const overviewStats = useMemo(() => {
    const disabledUsers = users.filter((user) =>
      Boolean(user.isDisabled),
    ).length;
    const mutedUsers = users.filter(
      (user) => !user.isDisabled && isMutedUser(user),
    ).length;
    const activeUsers = users.length - disabledUsers - mutedUsers;
    const privateRooms = rooms.filter((room) => room.isPrivate).length;
    const totalOnline = rooms.reduce((sum, room) => sum + room.onlineUsers, 0);
    const activeInvites = invites.filter((invite) => invite.isActive).length;
    return {
      activeUsers,
      mutedUsers,
      disabledUsers,
      privateRooms,
      totalOnline,
      activeInvites,
    };
  }, [invites, rooms, users]);

  const busiestRooms = useMemo(
    () =>
      [...rooms]
        .sort(
          (a, b) =>
            roomCapacityPercent(b.onlineUsers, b.maxUsers) -
            roomCapacityPercent(a.onlineUsers, a.maxUsers),
        )
        .slice(0, 5),
    [rooms],
  );

  const updateUserInDashboard = useCallback((updated: User) => {
    setDashboard((prev) =>
      prev
        ? {
            ...prev,
            users: prev.users.map((u) => (u.id === updated.id ? updated : u)),
          }
        : prev,
    );
  }, []);

  const handleRoleChange = useCallback(
    async (user: User, nextRole: string) => {
      const currentRole = user.role ?? "user";
      if (nextRole === currentRole) return;
      setUserBusy(user.id, true);
      try {
        const updated = await api.updateAdminUserRole(user.id, nextRole);
        updateUserInDashboard(updated);
        setRoleDrafts((prev) => ({
          ...prev,
          [user.id]: updated.role ?? "user",
        }));
        addToast(`Updated role for ${updated.username}`, "success");
      } catch (e) {
        setRoleDrafts((prev) => ({ ...prev, [user.id]: currentRole }));
        const message =
          e instanceof Error ? e.message : "Failed to update role";
        addToast(message, "error");
      } finally {
        setUserBusy(user.id, false);
      }
    },
    [addToast, setUserBusy, updateUserInDashboard],
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
        const message =
          e instanceof Error ? e.message : "Failed to update user";
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
        const message =
          e instanceof Error ? e.message : "Failed to update user";
        addToast(message, "error");
      } finally {
        setUserBusy(user.id, false);
      }
    },
    [addToast, confirm, setUserBusy, updateUserInDashboard],
  );

  const createInvite = useCallback(async () => {
    if (!canManagePlatformUsers) return;
    const parsedMaxUses = inviteMaxUses.trim()
      ? Number(inviteMaxUses)
      : undefined;
    const parsedExpires = inviteExpiresHours.trim()
      ? Number(inviteExpiresHours)
      : undefined;

    if (
      parsedMaxUses !== undefined &&
      (!Number.isInteger(parsedMaxUses) || parsedMaxUses <= 0)
    ) {
      addToast("Max uses must be a positive integer", "error");
      return;
    }
    if (
      parsedExpires !== undefined &&
      (!Number.isInteger(parsedExpires) || parsedExpires <= 0)
    ) {
      addToast("Expire hours must be a positive integer", "error");
      return;
    }

    setCreatingInvite(true);
    try {
      const created = await api.createAdminInvite(parsedMaxUses, parsedExpires);
      setLatestInviteCode(created.code);
      setDashboard((prev) =>
        prev
          ? {
              ...prev,
              invites: [
                created.invite,
                ...prev.invites.filter((i) => i.id !== created.invite.id),
              ],
            }
          : prev,
      );
      addToast("Invite link created", "success");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to create invite";
      addToast(message, "error");
    } finally {
      setCreatingInvite(false);
    }
  }, [addToast, canManagePlatformUsers, inviteExpiresHours, inviteMaxUses]);

  const revokeInvite = useCallback(
    async (invite: InviteLink) => {
      const confirmed = await confirm({
        title: "REVOKE INVITE",
        message: `Revoke invite ${invite.codePreview}?`,
        confirmText: "REVOKE",
        cancelText: "CANCEL",
        tone: "danger",
      });
      if (!confirmed) return;

      try {
        const updated = await api.revokeAdminInvite(invite.id);
        setDashboard((prev) =>
          prev
            ? {
                ...prev,
                invites: prev.invites.map((it) =>
                  it.id === updated.id ? updated : it,
                ),
              }
            : prev,
        );
        addToast("Invite revoked", "success");
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Failed to revoke invite";
        addToast(message, "error");
      }
    },
    [addToast, confirm],
  );

  const changeRegistrationMode = useCallback(
    async (mode: RegistrationMode) => {
      if (!canManagePlatformUsers || mode === registrationMode) return;
      const confirmed = await confirm({
        title: "UPDATE REGISTRATION MODE",
        message:
          mode === "invite_only"
            ? "Switch to invite-only registration?"
            : "Switch to open registration?",
        confirmText: "CONFIRM",
        cancelText: "CANCEL",
        tone: "danger",
      });
      if (!confirmed) return;

      setUpdatingMode(true);
      try {
        const updated = await api.updateRegistrationMode(mode);
        setDashboard((prev) =>
          prev
            ? {
                ...prev,
                registrationMode: updated.mode,
              }
            : prev,
        );
        addToast(`Registration mode: ${updated.mode}`, "success");
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Failed to update mode";
        addToast(message, "error");
      } finally {
        setUpdatingMode(false);
      }
    },
    [addToast, canManagePlatformUsers, confirm, registrationMode],
  );

  const copyLatestInviteCode = useCallback(async () => {
    if (!latestInviteCode) return;
    try {
      await navigator.clipboard.writeText(latestInviteCode);
      addToast("Invite code copied", "success");
    } catch {
      addToast("Clipboard copy failed", "error");
    }
  }, [addToast, latestInviteCode]);

  const renderOverviewTab = () => (
    <div className="admin-tab-stack">
      <section className="admin-card">
        <h2 className="admin-card-title">PLATFORM SNAPSHOT</h2>
        <div className="admin-overview-metrics">
          <article className="admin-metric">
            <div className="admin-metric-label">USERS</div>
            <div className="admin-metric-value">{users.length}</div>
            <div className="admin-metric-meta">
              <span>active {overviewStats.activeUsers}</span>
              <span>muted {overviewStats.mutedUsers}</span>
              <span>disabled {overviewStats.disabledUsers}</span>
            </div>
          </article>
          <article className="admin-metric">
            <div className="admin-metric-label">ROOMS</div>
            <div className="admin-metric-value">{rooms.length}</div>
            <div className="admin-metric-meta">
              <span>private {overviewStats.privateRooms}</span>
              <span>online {overviewStats.totalOnline}</span>
            </div>
          </article>
          <article className="admin-metric">
            <div className="admin-metric-label">REGISTRATION</div>
            <div className="admin-metric-value">{registrationMode}</div>
            <div className="admin-metric-meta">
              <span>active invites {overviewStats.activeInvites}</span>
              <span>total invites {invites.length}</span>
            </div>
          </article>
        </div>
      </section>

      <section className="admin-card">
        <h2 className="admin-card-title">ROOM UTILIZATION (TOP 5)</h2>
        <div className="admin-overview-room-list">
          {busiestRooms.length === 0 ? (
            <div className="admin-dashboard-loading">NO ROOMS FOUND</div>
          ) : (
            busiestRooms.map((room) => {
              const percent = roomCapacityPercent(
                room.onlineUsers,
                room.maxUsers,
              );
              return (
                <div key={room.id} className="admin-overview-room-row">
                  <div className="admin-overview-room-head">
                    <span className="admin-overview-room-name">
                      {room.name}
                    </span>
                    <span className="admin-overview-room-ratio">
                      {room.onlineUsers}/{room.maxUsers} ({percent}%)
                    </span>
                  </div>
                  <div className="admin-room-capacity-track" aria-hidden>
                    <span
                      className="admin-room-capacity-fill"
                      style={{ width: `${Math.max(4, percent)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );

  const renderUsersTab = () => (
    <>
      <section className="admin-card">
        <h2 className="admin-card-title">PLATFORM USERS</h2>
      <div className="admin-user-filters">
        <input
          className="terminal-input admin-filter-input"
          type="text"
          value={userQuery}
          placeholder="Search username..."
          onChange={(e) => setUserQuery(e.target.value)}
        />
        <select
          className="terminal-select admin-filter-select"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRoleFilter)}
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
          onChange={(e) => setStateFilter(e.target.value as UserStateFilter)}
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
              filteredUsers.map((user) => {
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
                        onClick={() => setEditingUser(user)}
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
                          setRoleDrafts((prev) => ({
                            ...prev,
                            [user.id]: nextRole,
                          }));
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
                          disabled
                            ? "state-disabled"
                            : muted
                              ? "state-muted"
                              : "state-active"
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
                          onClick={() => setEditingUser(user)}
                        >
                          EDIT
                        </button>
                        {!isBot && (
                          <>
                            <button
                              type="button"
                              className="admin-mini-btn"
                              disabled={
                                !canManagePlatformUsers ||
                                isSelf ||
                                busy ||
                                disabled
                              }
                              onClick={() => void toggleMuted(user)}
                            >
                              {muted ? "UNMUTE" : "MUTE"}
                            </button>
                            <button
                              type="button"
                              className={`admin-mini-btn ${
                                disabled
                                  ? "admin-mini-btn-ok"
                                  : "admin-mini-btn-danger"
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
    </section>
    </>
  );

  const renderRoomsTab = () => (
    <section className="admin-card admin-rooms-card">
      <h2 className="admin-card-title">ROOMS OVERVIEW</h2>
      <div className="admin-room-list">
        {rooms.length === 0 ? (
          <div className="admin-dashboard-loading">NO ROOMS FOUND</div>
        ) : (
          rooms.map((room) => {
            const owner = room.creatorId ? usersById.get(room.creatorId) : null;
            const percent = roomCapacityPercent(
              room.onlineUsers,
              room.maxUsers,
            );
            return (
              <div key={room.id} className="admin-room-item">
                <div className="admin-room-item-title">
                  {room.name}
                  {room.isPrivate && <span className="room-lock-icon">🔒</span>}
                </div>
                <div className="admin-room-item-meta">
                  <span>
                    OWNER:{" "}
                    {owner?.username ??
                      (room.creatorId ? `USER #${room.creatorId}` : "SYSTEM")}
                  </span>
                  <span>ONLINE: {room.onlineUsers}</span>
                  <span>
                    CAPACITY: {room.onlineUsers}/{room.maxUsers}
                  </span>
                </div>
                <div className="admin-room-capacity-track" aria-hidden>
                  <span
                    className="admin-room-capacity-fill"
                    style={{ width: `${Math.max(4, percent)}%` }}
                  />
                </div>
                {room.description && (
                  <div className="admin-room-item-description">
                    {room.description}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );

  const handleUserSaved = useCallback((updatedUser: User, updatedConfig?: PersonaConfig) => {
    updateUserInDashboard(updatedUser);
    if (updatedConfig) {
      setPersonaConfigs((prev) => ({ ...prev, [updatedConfig.userId]: updatedConfig }));
    }
    setEditingUser(null);
  }, [updateUserInDashboard]);

  const renderControlTab = () => (
    <div className="admin-tab-stack">
      <section className="admin-card admin-access-card">
        <h2 className="admin-card-title">ACCESS CONTROL</h2>
        <div className="admin-control-panel">
          <div className="admin-control-row">
            <span className="admin-control-label">REGISTRATION MODE</span>
            <select
              className="terminal-select admin-filter-select admin-wide-select"
              value={registrationMode}
              disabled={!canManagePlatformUsers || updatingMode}
              onChange={(e) =>
                void changeRegistrationMode(e.target.value as RegistrationMode)
              }
            >
              <option value="open">open</option>
              <option value="invite_only">invite_only</option>
            </select>
          </div>

          <div className="admin-control-row">
            <span className="admin-control-label">CREATE INVITE LINK</span>
            <div className="admin-invite-create-grid">
              <input
                className="terminal-input admin-filter-input admin-invite-input"
                type="number"
                min={1}
                value={inviteMaxUses}
                placeholder="Max uses"
                onChange={(e) => setInviteMaxUses(e.target.value)}
              />
              <input
                className="terminal-input admin-filter-input admin-invite-input"
                type="number"
                min={1}
                value={inviteExpiresHours}
                placeholder="Expires (hours)"
                onChange={(e) => setInviteExpiresHours(e.target.value)}
              />
              <button
                type="button"
                className="admin-mini-btn admin-create-invite-btn"
                disabled={!canManagePlatformUsers || creatingInvite}
                onClick={() => void createInvite()}
              >
                {creatingInvite ? "CREATING..." : "CREATE INVITE"}
              </button>
            </div>
          </div>

          {latestInviteCode && (
            <div className="admin-latest-invite">
              <span className="admin-control-label">LATEST CODE</span>
              <code>{latestInviteCode}</code>
              <button
                type="button"
                className="admin-mini-btn"
                onClick={() => void copyLatestInviteCode()}
              >
                COPY
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="admin-card">
        <h2 className="admin-card-title">INVITE LINKS</h2>
        <div className="admin-invite-list">
          {invites.length === 0 ? (
            <div className="admin-dashboard-loading">NO INVITE LINKS YET</div>
          ) : (
            invites.map((invite) => (
              <div key={invite.id} className="admin-invite-item">
                <div className="admin-invite-head">
                  <span className="admin-invite-code">
                    {invite.codePreview}
                  </span>
                  <div className="admin-invite-actions">
                    <span
                      className={`admin-state-badge ${
                        invite.isActive ? "state-active" : "state-disabled"
                      }`}
                    >
                      {invite.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                    {invite.isActive && canManagePlatformUsers && (
                      <button
                        type="button"
                        className="admin-mini-btn admin-mini-btn-danger admin-revoke-btn"
                        onClick={() => void revokeInvite(invite)}
                      >
                        REVOKE
                      </button>
                    )}
                  </div>
                </div>
                <div className="admin-invite-meta">
                  <span>
                    USES: {invite.usedCount}/{invite.maxUses ?? "∞"}
                  </span>
                  <span>
                    EXPIRES:{" "}
                    {invite.expiresAt ? formatDate(invite.expiresAt) : "NEVER"}
                  </span>
                  <span>
                    BY:{" "}
                    {invite.createdByUsername ?? `#${invite.createdByUserId}`}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
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
        ) : (
          <div className="admin-dashboard-shell">
            <div
              className="admin-tabs"
              role="tablist"
              aria-label="Admin sections"
            >
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
            <div className="admin-tab-content">
              {activeTab === "overview" && renderOverviewTab()}
              {activeTab === "users" && renderUsersTab()}
              {activeTab === "rooms" && renderRoomsTab()}
              {activeTab === "control" && renderControlTab()}
            </div>
          </div>
        )}
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

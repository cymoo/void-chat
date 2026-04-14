import { useCallback, useMemo, useState } from "react";
import * as api from "@/api/client";
import { formatDate } from "@/lib/utils";
import type { AdminDashboardResponse, InviteLink, RegistrationMode } from "@/api/types";
import type { AdminTabProps } from "./types";

type SetDashboard = React.Dispatch<React.SetStateAction<AdminDashboardResponse | null>>;

interface AdminControlTabProps {
  dashboard: AdminDashboardResponse;
  canManagePlatformUsers: boolean;
  addToast: AdminTabProps["addToast"];
  confirm: AdminTabProps["confirm"];
  setDashboard: SetDashboard;
}

export function AdminControlTab({
  dashboard,
  canManagePlatformUsers,
  addToast,
  confirm,
  setDashboard,
}: AdminControlTabProps) {
  const invites = useMemo(() => dashboard.invites ?? [], [dashboard]);
  const registrationMode = dashboard.registrationMode ?? "open";

  const [inviteMaxUses, setInviteMaxUses] = useState("");
  const [inviteExpiresHours, setInviteExpiresHours] = useState("24");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [latestInviteCode, setLatestInviteCode] = useState<string | null>(null);
  const [updatingMode, setUpdatingMode] = useState(false);

  const createInvite = useCallback(async () => {
    if (!canManagePlatformUsers) return;
    const parsedMaxUses = inviteMaxUses.trim() ? Number(inviteMaxUses) : undefined;
    const parsedExpires = inviteExpiresHours.trim() ? Number(inviteExpiresHours) : undefined;

    if (parsedMaxUses !== undefined && (!Number.isInteger(parsedMaxUses) || parsedMaxUses <= 0)) {
      addToast("Max uses must be a positive integer", "error");
      return;
    }
    if (parsedExpires !== undefined && (!Number.isInteger(parsedExpires) || parsedExpires <= 0)) {
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
              invites: [created.invite, ...prev.invites.filter((i) => i.id !== created.invite.id)],
            }
          : prev,
      );
      addToast("Invite link created", "success");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create invite";
      addToast(message, "error");
    } finally {
      setCreatingInvite(false);
    }
  }, [addToast, canManagePlatformUsers, inviteExpiresHours, inviteMaxUses, setDashboard]);

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
            ? { ...prev, invites: prev.invites.map((it) => (it.id === updated.id ? updated : it)) }
            : prev,
        );
        addToast("Invite revoked", "success");
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to revoke invite";
        addToast(message, "error");
      }
    },
    [addToast, confirm, setDashboard],
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
          prev ? { ...prev, registrationMode: updated.mode } : prev,
        );
        addToast(`Registration mode: ${updated.mode}`, "success");
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to update mode";
        addToast(message, "error");
      } finally {
        setUpdatingMode(false);
      }
    },
    [addToast, canManagePlatformUsers, confirm, registrationMode, setDashboard],
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

  return (
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
              onChange={(e) => void changeRegistrationMode(e.target.value as RegistrationMode)}
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
                  <span className="admin-invite-code">{invite.codePreview}</span>
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
                  <span>EXPIRES: {invite.expiresAt ? formatDate(invite.expiresAt) : "NEVER"}</span>
                  <span>
                    BY: {invite.createdByUsername ?? `#${invite.createdByUserId}`}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

import { useMemo } from "react";
import type { AdminTabProps } from "./types";
import { isMutedUser, roomCapacityPercent } from "./types";

export function AdminOverviewTab({ dashboard }: Pick<AdminTabProps, "dashboard">) {
  const users = useMemo(() => dashboard.users ?? [], [dashboard]);
  const invites = useMemo(() => dashboard.invites ?? [], [dashboard]);
  const rooms = useMemo(() => dashboard.rooms ?? [], [dashboard]);
  const registrationMode = dashboard.registrationMode ?? "open";

  const overviewStats = useMemo(() => {
    const disabledUsers = users.filter((user) => Boolean(user.isDisabled)).length;
    const mutedUsers = users.filter(
      (user) => !user.isDisabled && isMutedUser(user),
    ).length;
    const activeUsers = users.length - disabledUsers - mutedUsers;
    const privateRooms = rooms.filter((room) => room.isPrivate).length;
    const totalOnline = rooms.reduce((sum, room) => sum + room.onlineUsers, 0);
    const activeInvites = invites.filter((invite) => invite.isActive).length;
    return { activeUsers, mutedUsers, disabledUsers, privateRooms, totalOnline, activeInvites };
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

  return (
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
              const percent = roomCapacityPercent(room.onlineUsers, room.maxUsers);
              return (
                <div key={room.id} className="admin-overview-room-row">
                  <div className="admin-overview-room-head">
                    <span className="admin-overview-room-name">{room.name}</span>
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
}

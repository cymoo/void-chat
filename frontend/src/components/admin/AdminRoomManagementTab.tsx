import { useMemo } from "react";
import type { AdminDashboardResponse, User } from "@/api/types";
import { roomCapacityPercent } from "./types";

interface AdminRoomManagementTabProps {
  dashboard: AdminDashboardResponse;
}

export function AdminRoomManagementTab({ dashboard }: AdminRoomManagementTabProps) {
  const rooms = useMemo(() => dashboard.rooms ?? [], [dashboard]);
  const usersById = useMemo(
    () => new Map((dashboard.users ?? []).map((u: User) => [u.id, u])),
    [dashboard],
  );

  return (
    <section className="admin-card admin-rooms-card">
      <h2 className="admin-card-title">ROOMS OVERVIEW</h2>
      <div className="admin-room-list">
        {rooms.length === 0 ? (
          <div className="admin-dashboard-loading">NO ROOMS FOUND</div>
        ) : (
          rooms.map((room) => {
            const owner = room.creatorId ? usersById.get(room.creatorId) : null;
            const percent = roomCapacityPercent(room.onlineUsers, room.maxUsers);
            return (
              <div key={room.id} className="admin-room-item">
                <div className="admin-room-item-title">
                  {room.name}
                  {room.isPrivate && <span className="room-lock-icon">🔒</span>}
                </div>
                <div className="admin-room-item-meta">
                  <span>
                    OWNER:{" "}
                    {owner?.username ?? (room.creatorId ? `USER #${room.creatorId}` : "SYSTEM")}
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
                  <div className="admin-room-item-description">{room.description}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

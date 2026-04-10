import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRoomStore } from "@/stores/roomStore";
import type { Room, RoomInfo, UpdateRoomRequest } from "@/api/types";

vi.mock("@/api/client", () => ({
  getRooms: vi.fn(),
  createRoom: vi.fn(),
  deleteRoom: vi.fn(),
  updateRoom: vi.fn(),
}));

import * as api from "@/api/client";

describe("roomStore", () => {
  beforeEach(() => {
    useRoomStore.setState({
      rooms: [],
      currentRoomId: null,
      currentRoomName: "",
      currentRoomPassword: "",
      loading: false,
    });
    vi.clearAllMocks();
  });

  it("updateRoom refreshes rooms and current room name", async () => {
    const updatedRoom: Room = {
      id: 1,
      name: "edited-room",
      description: "edited-description",
      isPrivate: false,
      creatorId: 1,
      createdAt: 0,
      maxUsers: 100,
    };
    const refreshedRooms: RoomInfo[] = [
      {
        id: 1,
        name: "edited-room",
        description: "edited-description",
        isPrivate: false,
        creatorId: 1,
        onlineUsers: 3,
        maxUsers: 100,
      },
    ];

    const req: UpdateRoomRequest = {
      name: "edited-room",
      description: "edited-description",
      isPrivate: false,
      password: null,
    };

    useRoomStore.setState({
      currentRoomId: 1,
      currentRoomName: "old-room",
      currentRoomPassword: "",
    });
    vi.mocked(api.updateRoom).mockResolvedValue(updatedRoom);
    vi.mocked(api.getRooms).mockResolvedValue(refreshedRooms);

    const room = await useRoomStore.getState().updateRoom(1, req);

    expect(api.updateRoom).toHaveBeenCalledWith(1, req);
    expect(room).toEqual(updatedRoom);
    expect(useRoomStore.getState().rooms).toEqual(refreshedRooms);
    expect(useRoomStore.getState().currentRoomName).toBe("edited-room");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRoomStore } from "@/stores/roomStore";
import type { Room, RoomInfo, CreateRoomRequest, UpdateRoomRequest } from "@/api/types";

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
      error: null,
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

  it("fetchRooms sets error on failure", async () => {
    vi.mocked(api.getRooms).mockRejectedValue(new Error("network error"));
    await useRoomStore.getState().fetchRooms();
    expect(useRoomStore.getState().error).toBe("network error");
    expect(useRoomStore.getState().loading).toBe(false);
  });

  it("fetchRooms clears error on success", async () => {
    useRoomStore.setState({ error: "old error" });
    const rooms: RoomInfo[] = [];
    vi.mocked(api.getRooms).mockResolvedValue(rooms);
    await useRoomStore.getState().fetchRooms();
    expect(useRoomStore.getState().error).toBeNull();
  });

  it("fetchRooms populates rooms on success", async () => {
    const rooms: RoomInfo[] = [
      { id: 1, name: "general", description: "", isPrivate: false, creatorId: 1, onlineUsers: 2, maxUsers: 100 },
      { id: 2, name: "random", description: "", isPrivate: false, creatorId: 1, onlineUsers: 0, maxUsers: 100 },
    ];
    vi.mocked(api.getRooms).mockResolvedValue(rooms);
    await useRoomStore.getState().fetchRooms();
    expect(useRoomStore.getState().rooms).toEqual(rooms);
  });

  it("fetchRooms sets loading true then false on success", async () => {
    let loadingDuringFetch = false;
    vi.mocked(api.getRooms).mockImplementation(async () => {
      loadingDuringFetch = useRoomStore.getState().loading;
      return [];
    });
    await useRoomStore.getState().fetchRooms();
    expect(loadingDuringFetch).toBe(true);
    expect(useRoomStore.getState().loading).toBe(false);
  });

  it("createRoom adds room to store", async () => {
    const newRoom: Room = { id: 3, name: "new-room", description: "", isPrivate: false, creatorId: 1, createdAt: 0, maxUsers: 100 };
    const updatedRooms: RoomInfo[] = [
      { id: 3, name: "new-room", description: "", isPrivate: false, creatorId: 1, onlineUsers: 1, maxUsers: 100 },
    ];
    vi.mocked(api.createRoom).mockResolvedValue(newRoom);
    vi.mocked(api.getRooms).mockResolvedValue(updatedRooms);

    const req: CreateRoomRequest = { name: "new-room", description: "", isPrivate: false, password: null, maxUsers: 100 };
    const result = await useRoomStore.getState().createRoom(req);

    expect(result).toEqual(newRoom);
    expect(useRoomStore.getState().rooms).toEqual(updatedRooms);
  });

  it("deleteRoom refreshes rooms list", async () => {
    const remainingRooms: RoomInfo[] = [
      { id: 2, name: "other", description: "", isPrivate: false, creatorId: 1, onlineUsers: 0, maxUsers: 100 },
    ];
    vi.mocked(api.deleteRoom).mockResolvedValue(undefined);
    vi.mocked(api.getRooms).mockResolvedValue(remainingRooms);

    await useRoomStore.getState().deleteRoom(1);

    expect(api.deleteRoom).toHaveBeenCalledWith(1);
    expect(api.getRooms).toHaveBeenCalled();
    expect(useRoomStore.getState().rooms).toEqual(remainingRooms);
  });

  it("joinRoom sets currentRoomId, currentRoomName, currentRoomPassword", () => {
    useRoomStore.getState().joinRoom(1, "general", "pass");
    const state = useRoomStore.getState();
    expect(state.currentRoomId).toBe(1);
    expect(state.currentRoomName).toBe("general");
    expect(state.currentRoomPassword).toBe("pass");
  });

  it("leaveRoom clears room state", () => {
    useRoomStore.setState({ currentRoomId: 1, currentRoomName: "general", currentRoomPassword: "pass" });
    useRoomStore.getState().leaveRoom();
    const state = useRoomStore.getState();
    expect(state.currentRoomId).toBeNull();
    expect(state.currentRoomName).toBe("");
    expect(state.currentRoomPassword).toBe("");
  });

  it("updateRoom updates password when room becomes private", async () => {
    const updatedRoom: Room = { id: 1, name: "room", description: "", isPrivate: true, creatorId: 1, createdAt: 0, maxUsers: 100 };
    vi.mocked(api.updateRoom).mockResolvedValue(updatedRoom);
    vi.mocked(api.getRooms).mockResolvedValue([]);
    useRoomStore.setState({ currentRoomId: 1, currentRoomPassword: "" });

    const req: UpdateRoomRequest = { name: "room", description: "", isPrivate: true, password: "newpass" };
    await useRoomStore.getState().updateRoom(1, req);

    expect(useRoomStore.getState().currentRoomPassword).toBe("newpass");
  });

  it("updateRoom clears password when room becomes public", async () => {
    const updatedRoom: Room = { id: 1, name: "room", description: "", isPrivate: false, creatorId: 1, createdAt: 0, maxUsers: 100 };
    vi.mocked(api.updateRoom).mockResolvedValue(updatedRoom);
    vi.mocked(api.getRooms).mockResolvedValue([]);
    useRoomStore.setState({ currentRoomId: 1, currentRoomPassword: "oldpass" });

    const req: UpdateRoomRequest = { name: "room", description: "", isPrivate: false, password: null };
    await useRoomStore.getState().updateRoom(1, req);

    expect(useRoomStore.getState().currentRoomPassword).toBe("");
  });
});

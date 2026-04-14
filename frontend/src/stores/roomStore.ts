import { create } from "zustand";
import type {
  RoomInfo,
  CreateRoomRequest,
  UpdateRoomRequest,
  Room,
} from "@/api/types";
import * as api from "@/api/client";

interface RoomState {
  rooms: RoomInfo[];
  currentRoomId: number | null;
  currentRoomName: string;
  currentRoomPassword: string;
  loading: boolean;
  error: string | null;

  fetchRooms: () => Promise<void>;
  createRoom: (req: CreateRoomRequest) => Promise<Room>;
  updateRoom: (roomId: number, req: UpdateRoomRequest) => Promise<Room>;
  deleteRoom: (roomId: number) => Promise<void>;
  joinRoom: (roomId: number, roomName: string, password?: string) => void;
  leaveRoom: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  rooms: [],
  currentRoomId: null,
  currentRoomName: "",
  currentRoomPassword: "",
  loading: false,
  error: null,

  fetchRooms: async () => {
    set({ loading: true, error: null });
    try {
      const rooms = await api.getRooms();
      set({ rooms, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Failed to load rooms" });
    }
  },

  createRoom: async (req) => {
    const room = await api.createRoom(req);
    const rooms = await api.getRooms();
    set({ rooms });
    return room;
  },

  updateRoom: async (roomId, req) => {
    const room = await api.updateRoom(roomId, req);
    const rooms = await api.getRooms();
    set((state) => ({
      rooms,
      currentRoomName:
        state.currentRoomId === roomId ? room.name : state.currentRoomName,
      currentRoomPassword:
        state.currentRoomId !== roomId
          ? state.currentRoomPassword
          : room.isPrivate
            ? (req.password ?? state.currentRoomPassword)
            : "",
    }));
    return room;
  },

  deleteRoom: async (roomId) => {
    await api.deleteRoom(roomId);
    const rooms = await api.getRooms();
    set({ rooms });
  },

  joinRoom: (roomId, roomName, password = "") => {
    set({
      currentRoomId: roomId,
      currentRoomName: roomName,
      currentRoomPassword: password,
    });
  },

  leaveRoom: () => {
    set({
      currentRoomId: null,
      currentRoomName: "",
      currentRoomPassword: "",
    });
  },
}));

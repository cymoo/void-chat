import { create } from "zustand";
import type { RoomInfo, CreateRoomRequest, Room } from "@/api/types";
import * as api from "@/api/client";

interface RoomState {
  rooms: RoomInfo[];
  currentRoomId: number | null;
  currentRoomName: string;
  currentRoomPassword: string;
  loading: boolean;

  fetchRooms: () => Promise<void>;
  createRoom: (req: CreateRoomRequest) => Promise<Room>;
  joinRoom: (roomId: number, roomName: string, password?: string) => void;
  leaveRoom: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  rooms: [],
  currentRoomId: null,
  currentRoomName: "",
  currentRoomPassword: "",
  loading: false,

  fetchRooms: async () => {
    set({ loading: true });
    try {
      const rooms = await api.getRooms();
      set({ rooms, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createRoom: async (req) => {
    const room = await api.createRoom(req);
    // Refresh rooms list
    const rooms = await api.getRooms();
    set({ rooms });
    return room;
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

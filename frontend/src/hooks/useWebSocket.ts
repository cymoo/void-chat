import { useMemo, useRef, useCallback } from "react";
import type { WsEvent } from "@/api/types";
import { useUiStore } from "@/stores/uiStore";
import { useBaseWebSocket } from "./useBaseWebSocket";

interface UseWebSocketOptions {
  roomId: number;
  token: string;
  roomPassword?: string;
  onKicked?: (reason: string) => void;
  onConnectionError?: (message: string) => void;
}

export function useWebSocket({
  roomId,
  token,
  roomPassword,
  onKicked,
  onConnectionError,
}: UseWebSocketOptions) {
  const addToast = useUiStore((s) => s.addToast);

  const onKickedRef = useRef(onKicked);
  onKickedRef.current = onKicked;
  const onConnectionErrorRef = useRef(onConnectionError);
  onConnectionErrorRef.current = onConnectionError;
  const addToastRef = useRef(addToast);
  addToastRef.current = addToast;

  // Track whether we've received users/history (i.e., fully joined the room).
  // Stored in a ref so the onEvent closure always reads the latest value.
  const joinedRef = useRef(false);

  const url = useMemo(() => {
    if (!token || !Number.isFinite(roomId) || roomId <= 0) return null;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    let u = `${protocol}//${host}/chat/${roomId}?token=${encodeURIComponent(token)}`;
    if (roomPassword) {
      u += `&roomPassword=${encodeURIComponent(roomPassword)}`;
    }
    // Reset joined state whenever we build a new URL (i.e., reconnect)
    joinedRef.current = false;
    return u;
  }, [roomId, token, roomPassword]);

  const onEvent = useCallback((event: WsEvent): boolean | "close" => {
    if (event.type === "kicked") {
      onKickedRef.current?.(event.reason);
      return "close"; // close connection, no reconnect
    }

    if (event.type === "error") {
      if (!joinedRef.current) {
        onConnectionErrorRef.current?.(event.message);
        return "close"; // close connection, no reconnect
      }
      addToastRef.current(event.message, "error");
      return false;
    }

    if (event.type === "users" || event.type === "history") {
      joinedRef.current = true;
    }

    if (event.type === "mention") {
      addToastRef.current(`@${event.mentionedBy} mentioned you`, "info");
    }

    return true; // dispatch to store
  }, []);

  const onCleanup = useCallback((ws: WebSocket) => {
    ws.send(JSON.stringify({ type: "leave" }));
  }, []);

  const { send, status } = useBaseWebSocket({ url, onEvent, onCleanup });
  return { send, status };
}


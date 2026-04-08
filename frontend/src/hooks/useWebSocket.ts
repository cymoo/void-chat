import { useEffect, useRef, useCallback } from "react";
import type { WsEvent, WsSendPayload } from "@/api/types";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";

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
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const intentionalCloseRef = useRef(false);
  const joinedRef = useRef(false);
  const lastSendBlockedAtRef = useRef(0);
  const handleWsEvent = useChatStore((s) => s.handleWsEvent);
  const addToast = useUiStore((s) => s.addToast);

  const connect = useCallback(() => {
    if (!token || !Number.isFinite(roomId) || roomId <= 0) {
      return;
    }

    intentionalCloseRef.current = false;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    let url = `${protocol}//${host}/chat/${roomId}?token=${encodeURIComponent(token)}`;
    if (roomPassword) {
      url += `&roomPassword=${encodeURIComponent(roomPassword)}`;
    }

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as WsEvent;

        if (event.type === "kicked") {
          intentionalCloseRef.current = true;
          ws.close();
          onKicked?.(event.reason);
          return;
        }

        if (event.type === "error") {
          // If we haven't joined yet, this is a connection rejection (e.g. wrong password)
          if (!joinedRef.current) {
            intentionalCloseRef.current = true;
            ws.close();
            onConnectionError?.(event.message);
          } else {
            addToast(event.message, "error");
          }
          return;
        }

        // Mark as successfully joined once we receive users or history
        if (event.type === "users" || event.type === "history") {
          joinedRef.current = true;
        }

        if (event.type === "mention") {
          addToast(`@${event.mentionedBy} mentioned you`, "info");
        }

        handleWsEvent(event);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (intentionalCloseRef.current) return;

      const attempts = reconnectAttemptsRef.current;
      if (attempts < 5) {
        const delay = Math.min(1000 * Math.pow(2, attempts), 16000);
        reconnectAttemptsRef.current = attempts + 1;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      } else {
        addToast("Connection lost. Please refresh.", "error");
      }
    };

    ws.onerror = () => {
      // onclose will fire after this
    };
  }, [roomId, token, roomPassword, handleWsEvent, addToast, onKicked, onConnectionError]);

  useEffect(() => {
    joinedRef.current = false;
    connect();

    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const ws = wsRef.current;
      if (!ws) return;
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => ws.close();
        return;
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "leave" }));
        ws.close();
      }
    };
  }, [connect]);

  const send = useCallback((payload: WsSendPayload) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return;
    }
    const now = Date.now();
    if (now - lastSendBlockedAtRef.current > 2000) {
      addToast("Not connected yet. Retrying connection...", "error");
      lastSendBlockedAtRef.current = now;
    }
  }, [addToast]);

  return { send };
}

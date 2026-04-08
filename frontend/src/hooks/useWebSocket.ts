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
  const reconnectTimerRef = useRef<number | null>(null);
  const lastSendBlockedAtRef = useRef(0);

  const handleWsEvent = useChatStore((s) => s.handleWsEvent);
  const addToast = useUiStore((s) => s.addToast);

  // Stable refs so the effect closure always invokes the latest callbacks
  // without needing them in the dependency array (which would cause reconnects
  // on every render).
  const handleWsEventRef = useRef(handleWsEvent);
  handleWsEventRef.current = handleWsEvent;
  const addToastRef = useRef(addToast);
  addToastRef.current = addToast;
  const onKickedRef = useRef(onKicked);
  onKickedRef.current = onKicked;
  const onConnectionErrorRef = useRef(onConnectionError);
  onConnectionErrorRef.current = onConnectionError;

  useEffect(() => {
    if (!token || !Number.isFinite(roomId) || roomId <= 0) return;

    // `closed` is scoped to this effect invocation so that ALL callbacks
    // registered by this effect's WebSocket become no-ops once cleanup runs.
    let closed = false;
    let attempts = 0;
    let joined = false;
    // Handle for the initial deferred connect (see below).
    let connectTimer: number | null = null;

    function connect() {
      if (closed) return;
      connectTimer = null;

      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      let url = `${protocol}//${host}/chat/${roomId}?token=${encodeURIComponent(token)}`;
      if (roomPassword) {
        url += `&roomPassword=${encodeURIComponent(roomPassword)}`;
      }

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (closed) {
          ws.close();
          return;
        }
        attempts = 0;
      };

      ws.onmessage = (e) => {
        if (closed) return;
        try {
          const event = JSON.parse(e.data) as WsEvent;

          if (event.type === "kicked") {
            closed = true;
            ws.close();
            onKickedRef.current?.(event.reason);
            return;
          }

          if (event.type === "error") {
            if (!joined) {
              closed = true;
              ws.close();
              onConnectionErrorRef.current?.(event.message);
            } else {
              addToastRef.current(event.message, "error");
            }
            return;
          }

          if (event.type === "users" || event.type === "history") {
            joined = true;
          }

          if (event.type === "mention") {
            addToastRef.current(`@${event.mentionedBy} mentioned you`, "info");
          }

          handleWsEventRef.current(event);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (closed) return;

        if (attempts < 5) {
          const delay = Math.min(1000 * Math.pow(2, attempts), 16000);
          attempts++;
          reconnectTimerRef.current = window.setTimeout(connect, delay);
        } else {
          addToastRef.current("Connection lost. Please refresh.", "error");
        }
      };

      ws.onerror = () => {
        // onclose will fire after this
      };
    }

    // Defer the initial connection to the next macrotask. React Strict Mode's
    // double-mount (mount → cleanup → re-mount) happens synchronously, so the
    // cleanup of the first mount will clearTimeout before the WebSocket is ever
    // created — preventing the phantom connection that caused spurious
    // "joined" / "left" broadcasts on the server.
    connectTimer = window.setTimeout(connect, 0);

    return () => {
      closed = true;
      if (connectTimer !== null) {
        window.clearTimeout(connectTimer);
        connectTimer = null;
      }
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const ws = wsRef.current;
      wsRef.current = null;
      if (!ws) return;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "leave" }));
        ws.close();
      }
    };
  }, [roomId, token, roomPassword]); // Only reconnect when room/auth changes

  const send = useCallback((payload: WsSendPayload) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return;
    }
    const now = Date.now();
    if (now - lastSendBlockedAtRef.current > 2000) {
      addToastRef.current("Not connected yet. Retrying connection...", "error");
      lastSendBlockedAtRef.current = now;
    }
  }, []); // addToastRef is a ref — no deps needed

  return { send };
}

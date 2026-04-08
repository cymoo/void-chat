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

    // `closed` is scoped to this effect invocation. Setting it to true in the
    // cleanup function ensures that ALL callbacks registered by this effect's
    // WebSocket (onopen, onmessage, onclose) become no-ops — including any
    // pending reconnect timers. This is the key fix for the cascade-reconnect
    // bug caused by React Strict Mode's double-mount:
    //
    //   1. Effect runs → WS#1 created (still CONNECTING)
    //   2. Strict Mode cleanup → closed=true, ws.close() called on WS#1
    //   3. Effect re-runs → new closed=false closure, WS#2 created
    //   4. WS#1 eventually closes → its onclose sees closed=true → returns,
    //      no reconnect scheduled. WS#2 is the only live connection. ✓
    //
    // Previously a shared `intentionalCloseRef` was used, but step 3 would
    // reset it to false, causing WS#1's onclose to fire a spurious WS#3.
    let closed = false;
    let attempts = 0;
    let joined = false;

    function connect() {
      if (closed) return;

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
          // Cleanup ran while this WS was still connecting — close it now.
          // Calling close() here (rather than in the cleanup) ensures the
          // server never sees an open connection that will immediately vanish.
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
        // If closed=true this WS belongs to a superseded effect run — do not
        // reconnect, as a newer connection is already active (or the component
        // was intentionally unmounted).
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

    connect();

    return () => {
      closed = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const ws = wsRef.current;
      if (!ws) return;
      // Send "leave" only if the connection is fully open so the server can
      // cleanly remove the user before the socket closes.
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "leave" }));
      }
      // close() works for both CONNECTING and OPEN states. For a CONNECTING
      // socket the browser aborts the handshake; onclose fires (with closed=true)
      // and the onclose handler is a no-op, preventing any reconnect.
      ws.close();
      wsRef.current = null;
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

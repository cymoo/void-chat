import { useEffect, useRef, useCallback } from "react";
import type { WsEvent, WsSendPayload } from "@/api/types";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";

interface UseDirectWebSocketOptions {
  token: string;
}

export function useDirectWebSocket({ token }: UseDirectWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const lastSendBlockedAtRef = useRef(0);

  const handleWsEvent = useChatStore((s) => s.handleWsEvent);
  const addToast = useUiStore((s) => s.addToast);

  const handleWsEventRef = useRef(handleWsEvent);
  handleWsEventRef.current = handleWsEvent;
  const addToastRef = useRef(addToast);
  addToastRef.current = addToast;

  useEffect(() => {
    if (!token) return;

    let closed = false;
    let attempts = 0;
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
      const url = `${protocol}//${host}/chat/dm?token=${encodeURIComponent(token)}`;

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
          if (event.type === "error") {
            addToastRef.current(event.message, "error");
          }
          handleWsEventRef.current(event);
        } catch {
          // ignore malformed message
        }
      };

      ws.onclose = () => {
        if (closed) return;

        if (attempts < 5) {
          const delay = Math.min(1000 * Math.pow(2, attempts), 16000);
          attempts++;
          reconnectTimerRef.current = window.setTimeout(connect, delay);
        } else {
          addToastRef.current("Mailbox connection lost. Please refresh.", "error");
        }
      };

      ws.onerror = () => {
        // handled by onclose
      };
    }

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
        ws.close();
      }
    };
  }, [token]);

  const send = useCallback((payload: WsSendPayload) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return;
    }
    const now = Date.now();
    if (now - lastSendBlockedAtRef.current > 2000) {
      addToastRef.current("Mailbox is connecting, please retry in a moment.", "error");
      lastSendBlockedAtRef.current = now;
    }
  }, []);

  return { send };
}

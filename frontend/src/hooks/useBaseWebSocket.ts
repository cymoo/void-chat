import { useEffect, useRef, useCallback } from "react";
import type { WsEvent, WsSendPayload } from "@/api/types";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";

/**
 * Return value from the onEvent callback.
 * - `true` (or `undefined`): event is dispatched to handleWsEvent as normal
 * - `false`: event was fully handled by the callback, skip store dispatch
 * - `"close"`: skip store dispatch AND close the connection without reconnecting
 */
type OnEventResult = boolean | "close" | void;

interface UseBaseWebSocketOptions {
  /** Full WebSocket URL, or `null` to not connect. Reconnects when the value changes. */
  url: string | null;
  /** Per-message preprocessing. Return `false` to suppress default store dispatch. */
  onEvent?: (event: WsEvent) => OnEventResult;
  /** Called with the WebSocket right before cleanup closes it (e.g., send "leave"). */
  onCleanup?: (ws: WebSocket) => void;
  /** Toast text shown after max reconnect attempts are exhausted. */
  disconnectMessage?: string;
}

export function useBaseWebSocket({
  url,
  onEvent,
  onCleanup,
  disconnectMessage = "Connection lost. Please refresh.",
}: UseBaseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const lastSendBlockedAtRef = useRef(0);

  const handleWsEvent = useChatStore((s) => s.handleWsEvent);
  const addToast = useUiStore((s) => s.addToast);

  // Stable refs so the effect closure always invokes the latest callbacks
  // without needing them in the dependency array (which would cause reconnects).
  const handleWsEventRef = useRef(handleWsEvent);
  handleWsEventRef.current = handleWsEvent;
  const addToastRef = useRef(addToast);
  addToastRef.current = addToast;
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onCleanupRef = useRef(onCleanup);
  onCleanupRef.current = onCleanup;
  const disconnectMessageRef = useRef(disconnectMessage);
  disconnectMessageRef.current = disconnectMessage;

  useEffect(() => {
    if (!url) return;

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

      const ws = new WebSocket(url!);
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

          const result = onEventRef.current?.(event);
          if (result === "close") {
            // Consumer wants to terminate the connection (e.g., kicked, pre-join error).
            // Set `closed` so onclose won't attempt to reconnect.
            closed = true;
            ws.close();
            return;
          }
          if (result === false) return;

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
          addToastRef.current(disconnectMessageRef.current, "error");
        }
      };

      ws.onerror = () => {
        // onclose will fire after this
      };
    }

    // Defer the initial connection to the next macrotask. React Strict Mode's
    // double-mount (mount → cleanup → re-mount) happens synchronously, so the
    // cleanup of the first mount will clearTimeout before the WebSocket is ever
    // created — preventing phantom connections.
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
        onCleanupRef.current?.(ws);
        ws.close();
      }
    };
  }, [url]); // Only reconnect when the URL changes

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
  }, []);

  return { send };
}

import { useMemo, useCallback } from "react";
import type { WsEvent } from "@/api/types";
import { useUiStore } from "@/stores/uiStore";
import { useBaseWebSocket } from "./useBaseWebSocket";

interface UseDirectWebSocketOptions {
  token: string;
}

export function useDirectWebSocket({ token }: UseDirectWebSocketOptions) {
  const addToast = useUiStore((s) => s.addToast);

  const url = useMemo(() => {
    if (!token) return null;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    return `${protocol}//${host}/chat/dm?token=${encodeURIComponent(token)}`;
  }, [token]);

  const onEvent = useCallback(
    (event: WsEvent): boolean => {
      if (event.type === "error") {
        addToast(event.message, "error");
      }
      return true; // always dispatch to store
    },
    [addToast],
  );

  return useBaseWebSocket({
    url,
    onEvent,
    disconnectMessage: "Mailbox connection lost. Please refresh.",
  });
}


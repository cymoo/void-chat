import { useEffect, useState } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import * as api from "@/api/client";
import { getInitials } from "@/lib/utils";
import type { DmInboxEntry, WsSendPayload } from "@/api/types";

interface DmInboxModalProps {
  send?: (payload: WsSendPayload) => void;
}

export function DmInboxModal({ send }: DmInboxModalProps) {
  const dmInboxOpen = useUiStore((s) => s.dmInboxOpen);
  const setDmInboxOpen = useUiStore((s) => s.setDmInboxOpen);
  const addToast = useUiStore((s) => s.addToast);
  const openPrivateChat = useChatStore((s) => s.openPrivateChat);
  const [entries, setEntries] = useState<DmInboxEntry[]>([]);

  useEffect(() => {
    if (!dmInboxOpen) return;

    api
      .getDmInbox()
      .then((rows) =>
        setEntries(
          rows.filter(
            (row) => row.userId > 0 && row.username.trim().length > 0,
          ),
        ),
      )
      .catch((err) => {
        const message =
          err instanceof Error ? err.message : "Failed to load mailbox";
        addToast(message, "error");
      });
  }, [addToast, dmInboxOpen]);

  if (!dmInboxOpen) return null;

  const handleEntryClick = (entry: DmInboxEntry) => {
    if (!send) {
      addToast("Join any room to open a live DM chat", "info");
      return;
    }

    openPrivateChat(entry.userId, entry.username);
    send({ type: "private_history", targetUserId: entry.userId });
    setDmInboxOpen(false);
  };

  return (
    <div className="modal active">
      <div className="modal-backdrop" onClick={() => setDmInboxOpen(false)} />
      <div className="dm-inbox-container">
        <div className="modal-header">
          <div>
            <span className="modal-title">PRIVATE MAILBOX</span>
            <div className="dm-inbox-subtitle">
              {send
                ? "Select a user to open the DM stream."
                : "Browse contacts and unread counts from the lobby."}
            </div>
          </div>
          <button className="modal-close-btn" onClick={() => setDmInboxOpen(false)}>
            ✕
          </button>
        </div>
        <div className="dm-inbox-list">
          {entries.length === 0 ? (
            <div className="dm-inbox-empty">No users available</div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.userId}
                className="dm-inbox-item"
                onClick={() => handleEntryClick(entry)}
              >
                <div className="dm-inbox-avatar">
                  {entry.avatarUrl ? (
                    <img
                      src={entry.avatarUrl}
                      alt={entry.username}
                      className="avatar-img-large"
                    />
                  ) : (
                    getInitials(entry.username)
                  )}
                </div>
                <div className="dm-inbox-name-group">
                  <div className="dm-inbox-name">{entry.username}</div>
                  <div className="dm-inbox-meta">
                    {entry.unreadCount > 0 ? `${entry.unreadCount} unread` : "No unread"}
                  </div>
                </div>
                {entry.unreadCount > 0 && (
                  <div className="dm-inbox-badge">{entry.unreadCount}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

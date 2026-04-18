import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as api from "@/api/client";
import type { DmInboxEntry } from "@/api/types";
import { PrivateChat } from "@/components/chat/PrivateChat";
import { useDirectWebSocket } from "@/hooks/useDirectWebSocket";
import { formatTime, getInitials } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";

interface MailboxLocationState {
  returnTo?: string;
}

export function MailboxPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const addToast = useUiStore((s) => s.addToast);
  const privateChatUserId = useChatStore((s) => s.privateChatUserId);
  const unreadDmCount = useChatStore((s) => s.unreadDmCount);
  const openPrivateChat = useChatStore((s) => s.openPrivateChat);
  const [entries, setEntries] = useState<DmInboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { send } = useDirectWebSocket({ token: token ?? "" });
  const hasOpenedPrivateChatRef = useRef(false);
  const previousUnreadRef = useRef<number | null>(null);
  const state = (location.state as MailboxLocationState | null) ?? null;
  const returnTo = state?.returnTo ?? "/lobby";

  const loadInbox = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.getDmInbox();
      setEntries(
        rows.filter(
          (row) =>
            row.userId > 0 &&
            row.username.trim().length > 0 &&
            row.latestMessageTimestamp > 0,
        ),
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load mailbox";
      addToast(message, "error");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    if (privateChatUserId !== null) {
      hasOpenedPrivateChatRef.current = true;
      return;
    }
    if (!hasOpenedPrivateChatRef.current) return;
    void loadInbox();
    hasOpenedPrivateChatRef.current = false;
  }, [loadInbox, privateChatUserId]);

  useEffect(() => {
    if (previousUnreadRef.current === null) {
      previousUnreadRef.current = unreadDmCount;
      return;
    }
    if (previousUnreadRef.current === unreadDmCount) return;
    previousUnreadRef.current = unreadDmCount;
    void loadInbox();
  }, [loadInbox, unreadDmCount]);

  const totalUnread = useMemo(
    () => entries.reduce((sum, entry) => sum + Math.max(0, entry.unreadCount), 0),
    [entries],
  );

  const handleEntryClick = (entry: DmInboxEntry) => {
    openPrivateChat(entry.userId, entry.username);
    send({ type: "private_history", targetUserId: entry.userId });
  };

  const backLabel = returnTo.startsWith("/chat/") ? "BACK TO CHAT" : "BACK TO LOBBY";

  return (
    <div id="mailbox-screen" className="screen active">
      <div className="mailbox-page">
        <div className="mailbox-container">
          <div className="mailbox-header">
            <div>
              <div className="mailbox-title">PRIVATE MAILBOX</div>
              <div className="mailbox-subtitle">
                {entries.length} conversations / {totalUnread} unread
              </div>
            </div>
            <div className="mailbox-actions">
              <div className="mailbox-user-tag">{user?.username ?? "USER"}</div>
              <button className="mailbox-back-btn" onClick={() => navigate(returnTo)}>
                {backLabel}
              </button>
            </div>
          </div>

          <div className="mailbox-list">
            {loading ? (
              <div className="mailbox-empty">LOADING MAILBOX...</div>
            ) : entries.length === 0 ? (
              <div className="mailbox-empty">NO PRIVATE CONVERSATIONS YET</div>
            ) : (
              entries.map((entry) => {
                const sentByCurrentUser = entry.latestMessageSenderId === user?.id;
                return (
                  <button
                    key={entry.userId}
                    type="button"
                    className={`mailbox-item${entry.unreadCount > 0 ? " unread" : ""}`}
                    onClick={() => handleEntryClick(entry)}
                  >
                    <div className="mailbox-avatar">
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
                    <div className="mailbox-item-main">
                      <div className="mailbox-item-head">
                        <span className="mailbox-name">{entry.username}</span>
                        <span className="mailbox-time">
                          {formatTime(entry.latestMessageTimestamp)}
                        </span>
                      </div>
                      <div className="mailbox-preview">
                        {sentByCurrentUser ? "You: " : ""}
                        {entry.latestMessagePreview || "(empty message)"}
                      </div>
                    </div>
                    <div className="mailbox-item-side">
                      {entry.unreadCount > 0 ? (
                        <span className="mailbox-badge">{entry.unreadCount}</span>
                      ) : (
                        <span className="mailbox-read-state">READ</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {privateChatUserId !== null && user && <PrivateChat send={send} currentUser={user} />}
    </div>
  );
}

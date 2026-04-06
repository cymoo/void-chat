import { useEffect, useState } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import * as api from "@/api/client";
import { getInitials } from "@/lib/utils";
import type { WsSendPayload } from "@/api/types";

interface DmInboxModalProps {
  send: (payload: WsSendPayload) => void;
}

interface DmSender {
  senderId: number;
  senderUsername: string;
  unreadCount: number;
}

export function DmInboxModal({ send }: DmInboxModalProps) {
  const dmInboxOpen = useUiStore((s) => s.dmInboxOpen);
  const setDmInboxOpen = useUiStore((s) => s.setDmInboxOpen);
  const openPrivateChat = useChatStore((s) => s.openPrivateChat);
  const [senders, setSenders] = useState<DmSender[]>([]);

  useEffect(() => {
    if (dmInboxOpen) {
      api.getUnreadDmSenders().then(setSenders).catch(() => {});
    }
  }, [dmInboxOpen]);

  if (!dmInboxOpen) return null;

  const handleSenderClick = (sender: DmSender) => {
    openPrivateChat(sender.senderId, sender.senderUsername);
    send({ type: "private_history", targetUserId: sender.senderId });
    setDmInboxOpen(false);
  };

  return (
    <div className="modal active">
      <div className="modal-backdrop" onClick={() => setDmInboxOpen(false)} />
      <div className="dm-inbox-container">
        <div className="modal-header">
          <span className="modal-title">UNREAD MESSAGES</span>
          <button className="modal-close-btn" onClick={() => setDmInboxOpen(false)}>
            ✕
          </button>
        </div>
        <div className="dm-inbox-list">
          {senders.length === 0 ? (
            <div className="dm-inbox-empty">No unread messages</div>
          ) : (
            senders.map((s) => (
              <div
                key={s.senderId}
                className="dm-inbox-item"
                onClick={() => handleSenderClick(s)}
              >
                <div className="dm-inbox-avatar">{getInitials(s.senderUsername)}</div>
                <div className="dm-inbox-name">{s.senderUsername}</div>
                <div className="dm-inbox-badge">{s.unreadCount}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

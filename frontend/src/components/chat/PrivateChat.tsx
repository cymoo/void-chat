import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { useChatStore } from "@/stores/chatStore";
import { renderMarkdown } from "@/lib/markdown";
import { formatTime } from "@/lib/utils";
import type { User, WsSendPayload } from "@/api/types";

interface PrivateChatProps {
  send: (payload: WsSendPayload) => void;
  currentUser: User;
}

export function PrivateChat({ send, currentUser }: PrivateChatProps) {
  const [text, setText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const privateChatUserId = useChatStore((s) => s.privateChatUserId);
  const privateChatUsername = useChatStore((s) => s.privateChatUsername);
  const privateMessages = useChatStore((s) => s.privateMessages);
  const closePrivateChat = useChatStore((s) => s.closePrivateChat);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [privateMessages]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !privateChatUserId) return;
    send({
      type: "private_message",
      targetUserId: privateChatUserId,
      content: trimmed,
    });
    setText("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    <div className="modal active">
      <div className="modal-backdrop" onClick={closePrivateChat} />
      <div className="private-chat-panel">
        <div className="private-chat-header">
          <span>DM: {privateChatUsername}</span>
          <button className="modal-close panel-close-btn" onClick={closePrivateChat}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="private-chat-messages">
          {privateMessages.map((msg) => {
            const isSelf = msg.senderId === currentUser.id;
            return (
              <div
                key={msg.id}
                className={`private-msg ${isSelf ? "private-msg-self" : "private-msg-other"}`}
              >
                <div className="private-msg-author">{msg.senderUsername}</div>
                <div
                  className="private-msg-content"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(msg.content ?? ""),
                  }}
                />
                <div className="private-msg-time">{formatTime(msg.timestamp)}</div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        <div className="private-chat-input">
          <input
            className="message-input"
            type="text"
            placeholder="Type a private message..."
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <button className="icon-btn send-btn" onClick={handleSend}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

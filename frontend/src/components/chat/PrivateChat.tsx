import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import type { WsSendPayload } from "@/api/types";
import { useChatStore } from "@/stores/chatStore";
import { formatTime } from "@/lib/utils";

interface PrivateChatProps {
  send: (payload: WsSendPayload) => void;
}

export function PrivateChat({ send }: PrivateChatProps) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const privateChatUserId = useChatStore((s) => s.privateChatUserId);
  const privateChatUsername = useChatStore((s) => s.privateChatUsername);
  const privateMessages = useChatStore((s) => s.privateMessages);
  const privateHasMore = useChatStore((s) => s.privateHasMore);
  const closePrivateChat = useChatStore((s) => s.closePrivateChat);

  // Request history when opening
  useEffect(() => {
    if (privateChatUserId !== null) {
      send({ type: "private_history", targetUserId: privateChatUserId });
    }
  }, [privateChatUserId, send]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [privateMessages]);

  const handleSend = () => {
    if (!text.trim() || !privateChatUserId) return;
    send({
      type: "private_message",
      targetUserId: privateChatUserId,
      content: text.trim(),
    });
    setText("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      closePrivateChat();
    }
  };

  const loadMore = () => {
    if (!privateHasMore || privateMessages.length === 0 || !privateChatUserId) return;
    send({
      type: "private_history",
      targetUserId: privateChatUserId,
      beforeId: privateMessages[0]!.id,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-40">
      <div className="bg-terminal-surface border border-terminal-border w-full max-w-lg h-[500px] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-terminal-border">
          <span className="text-terminal-amber text-sm font-bold">
            DM → @{privateChatUsername}
          </span>
          <button
            onClick={closePrivateChat}
            className="text-terminal-text-dim hover:text-terminal-red text-sm"
          >
            [ CLOSE ]
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {privateHasMore && (
            <button
              onClick={loadMore}
              className="w-full text-center text-terminal-text-dim text-xs py-1 hover:text-terminal-green"
            >
              ↑ load older messages
            </button>
          )}

          {privateMessages.length === 0 ? (
            <div className="text-terminal-text-dim text-center text-sm py-8">
              No messages yet. Say hello!
            </div>
          ) : (
            privateMessages.map((msg) => (
              <div key={msg.id} className="py-1">
                <span className="text-terminal-border text-xs mr-2">
                  {formatTime(msg.timestamp)}
                </span>
                <span
                  className={`text-sm font-bold mr-2 ${
                    msg.senderId === privateChatUserId
                      ? "text-terminal-cyan"
                      : "text-terminal-green"
                  }`}
                >
                  {msg.senderUsername}
                </span>
                <span className="text-terminal-text text-sm">{msg.content}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-terminal-border px-4 py-2 flex items-center gap-2">
          <span className="text-terminal-amber shrink-0">DM $</span>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-terminal-text font-mono text-sm focus:outline-none"
            placeholder="type a private message..."
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}

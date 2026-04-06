import { useEffect, useState } from "react";
import { useUiStore } from "@/stores/uiStore";
import { useChatStore } from "@/stores/chatStore";
import * as api from "@/api/client";
import type { User } from "@/api/types";

export function UserCard() {
  const userCardUserId = useUiStore((s) => s.userCardUserId);
  const hideUserCard = useUiStore((s) => s.hideUserCard);
  const openPrivateChat = useChatStore((s) => s.openPrivateChat);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (userCardUserId === null) {
      setUser(null);
      return;
    }
    api.getUser(userCardUserId).then(setUser).catch(() => setUser(null));
  }, [userCardUserId]);

  if (userCardUserId === null || !user) return null;

  const handleDm = () => {
    openPrivateChat(user.id, user.username);
    hideUserCard();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={hideUserCard}
    >
      <div
        className="bg-terminal-surface border border-terminal-border p-4 max-w-xs w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="w-10 h-10 border border-terminal-border"
            />
          ) : (
            <div className="w-10 h-10 border border-terminal-border flex items-center justify-center text-terminal-green text-sm font-bold">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-terminal-green font-bold text-sm">
              {user.username}
            </div>
            {user.role && (
              <div className="text-terminal-amber text-xs">[{user.role}]</div>
            )}
          </div>
        </div>

        {user.status && (
          <div className="text-terminal-text text-xs mb-2">
            <span className="text-terminal-text-dim">STATUS:</span> {user.status}
          </div>
        )}

        {user.bio && (
          <div className="text-terminal-text text-xs mb-3">
            <span className="text-terminal-text-dim">BIO:</span> {user.bio}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleDm}
            className="flex-1 border border-terminal-amber text-terminal-amber px-2 py-1 text-xs hover:bg-terminal-amber hover:text-terminal-bg transition-colors"
          >
            [ SEND DM ]
          </button>
          <button
            onClick={hideUserCard}
            className="flex-1 border border-terminal-border text-terminal-text-dim px-2 py-1 text-xs hover:border-terminal-text hover:text-terminal-text transition-colors"
          >
            [ CLOSE ]
          </button>
        </div>
      </div>
    </div>
  );
}

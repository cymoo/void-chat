import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import { cn } from "@/lib/utils";

export function UserSidebar() {
  const users = useChatStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const openPrivateChat = useChatStore((s) => s.openPrivateChat);
  const unreadDmCount = useChatStore((s) => s.unreadDmCount);
  const showUserCard = useUiStore((s) => s.showUserCard);

  return (
    <aside className="w-56 border-l border-terminal-border bg-terminal-surface flex flex-col shrink-0 hidden md:flex">
      {/* Header */}
      <div className="px-3 py-2 border-b border-terminal-border">
        <div className="text-terminal-green text-xs font-bold">
          ONLINE [{users.length}]
        </div>
        {unreadDmCount > 0 && (
          <div className="text-terminal-amber text-xs mt-1">
            {unreadDmCount} unread DM{unreadDmCount > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* User list */}
      <div className="flex-1 overflow-y-auto">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between px-3 py-1.5 hover:bg-terminal-surface-2 group"
          >
            <button
              onClick={() => showUserCard(user.id)}
              className={cn(
                "text-sm truncate",
                user.id === currentUserId
                  ? "text-terminal-green"
                  : "text-terminal-text hover:text-terminal-cyan",
              )}
            >
              <span className="text-terminal-text-dim mr-1">
                {user.role === "admin" ? "★" : user.role === "moderator" ? "◆" : "·"}
              </span>
              {user.username}
              {user.id === currentUserId && (
                <span className="text-terminal-text-dim ml-1">(you)</span>
              )}
            </button>

            {user.id !== currentUserId && (
              <button
                onClick={() => openPrivateChat(user.id, user.username)}
                className="opacity-0 group-hover:opacity-100 text-terminal-text-dim hover:text-terminal-amber text-xs transition-opacity"
                title="Send DM"
              >
                ✉
              </button>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}

import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useRoomStore } from "@/stores/roomStore";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { UserSidebar } from "./UserSidebar";
import { SearchPanel } from "./SearchPanel";
import { PrivateChat } from "./PrivateChat";

export function ChatView() {
  const { roomId: roomIdParam } = useParams<{ roomId: string }>();
  const roomId = Number(roomIdParam);
  const navigate = useNavigate();

  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const roomName = useRoomStore((s) => s.currentRoomName);
  const roomPassword = useRoomStore((s) => s.currentRoomPassword);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);
  const reset = useChatStore((s) => s.reset);
  const searchOpen = useUiStore((s) => s.searchOpen);
  const toggleSearch = useUiStore((s) => s.toggleSearch);
  const privateChatUserId = useChatStore((s) => s.privateChatUserId);
  const addToast = useUiStore((s) => s.addToast);

  const handleKicked = useCallback(
    (reason: string) => {
      addToast(`Kicked: ${reason}`, "error");
      reset();
      leaveRoom();
      navigate("/lobby");
    },
    [addToast, reset, leaveRoom, navigate],
  );

  const { send } = useWebSocket({
    roomId,
    token: token ?? "",
    roomPassword,
    onKicked: handleKicked,
  });

  const handleLeave = () => {
    reset();
    leaveRoom();
    navigate("/lobby");
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-terminal-border px-4 py-2 bg-terminal-surface shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLeave}
            className="text-terminal-text-dim hover:text-terminal-red text-sm transition-colors"
          >
            {"<"} EXIT
          </button>
          <div className="text-terminal-border">│</div>
          <span className="text-terminal-green font-bold">#{roomName || `room-${roomId}`}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSearch}
            className={`px-2 py-1 text-xs border transition-colors ${
              searchOpen
                ? "border-terminal-green text-terminal-green"
                : "border-terminal-border text-terminal-text-dim hover:border-terminal-green hover:text-terminal-green"
            }`}
          >
            [SEARCH]
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Messages area */}
        <div className="flex flex-1 flex-col min-w-0">
          {searchOpen && <SearchPanel send={send} />}
          <MessageList send={send} userId={user?.id ?? 0} />
          <MessageInput send={send} userId={user?.id ?? 0} username={user?.username ?? ""} />
        </div>

        {/* Sidebar */}
        <UserSidebar />
      </div>

      {/* Private chat overlay */}
      {privateChatUserId !== null && <PrivateChat send={send} />}
    </div>
  );
}

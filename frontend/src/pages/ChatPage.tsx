import { useEffect, useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useRoomStore } from "@/stores/roomStore";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import { ChatView } from "@/components/chat/ChatView";
import { ProfileModal } from "@/components/profile/ProfileModal";
import { UserCard } from "@/components/profile/UserCard";
import { PrivateChat } from "@/components/chat/PrivateChat";

export function ChatPage() {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const { currentRoomName, currentRoomPassword, leaveRoom, rooms, fetchRooms, joinRoom } =
    useRoomStore();
  const reset = useChatStore((s) => s.reset);
  const addToast = useUiStore((s) => s.addToast);
  const userCardUserId = useUiStore((s) => s.userCardUserId);
  const privateChatUserId = useChatStore((s) => s.privateChatUserId);
  const roomIdNum = Number(roomId);
  const [profileOpen, setProfileOpen] = useState(false);

  const onKicked = useCallback(
    (reason: string) => {
      addToast(`You were kicked: ${reason}`, "error");
      leaveRoom();
      navigate("/lobby");
    },
    [addToast, leaveRoom, navigate],
  );

  const onConnectionError = useCallback(
    (message: string) => {
      addToast(message, "error");
      leaveRoom();
      navigate("/lobby");
    },
    [addToast, leaveRoom, navigate],
  );

  const { send, status } = useWebSocket({
    roomId: Number(roomId),
    token: token!,
    roomPassword: currentRoomPassword || undefined,
    onKicked,
    onConnectionError,
  });

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  useEffect(() => {
    if (!roomIdNum || currentRoomName) return;

    const matched = rooms.find((r) => r.id === roomIdNum);
    if (matched) {
      joinRoom(matched.id, matched.name, currentRoomPassword);
      return;
    }

    fetchRooms().then(() => {
      const latest = useRoomStore.getState().rooms.find((r) => r.id === roomIdNum);
      if (latest) {
        joinRoom(latest.id, latest.name, currentRoomPassword);
      }
    });
  }, [roomIdNum, currentRoomName, currentRoomPassword, rooms, fetchRooms, joinRoom]);

  const handleDisconnect = () => {
    leaveRoom();
    navigate("/lobby");
  };

  const handleOpenMailbox = () => {
    leaveRoom();
    navigate("/mailbox", {
      state: { returnTo: roomIdNum ? `/chat/${roomIdNum}` : "/lobby" },
    });
  };

  const displayedRoomName =
    currentRoomName || rooms.find((r) => r.id === roomIdNum)?.name || `Room ${roomId}`;

  return (
    <div id="chat-screen" className="screen active">
      <ChatView
        send={send}
        roomName={displayedRoomName}
        currentUser={user!}
        onDisconnect={handleDisconnect}
        onOpenMailbox={handleOpenMailbox}
        onOpenProfile={() => setProfileOpen(true)}
        wsStatus={status}
      />
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
      {userCardUserId !== null && <UserCard send={send} />}
      {privateChatUserId !== null && <PrivateChat send={send} currentUser={user!} />}
    </div>
  );
}

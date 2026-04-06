import { useEffect, useCallback } from "react";
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
import { ImageModal } from "@/components/chat/ImageModal";
import { DmInboxModal } from "@/components/chat/DmInboxModal";

export function ChatPage() {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const { currentRoomName, currentRoomPassword, leaveRoom } = useRoomStore();
  const reset = useChatStore((s) => s.reset);
  const { profileOpen, userCardUserId } = useUiStore();
  const privateChatUserId = useChatStore((s) => s.privateChatUserId);

  const onKicked = useCallback(
    (reason: string) => {
      alert(`You were kicked: ${reason}`);
      leaveRoom();
      navigate("/lobby");
    },
    [leaveRoom, navigate],
  );

  const { send } = useWebSocket({
    roomId: Number(roomId),
    token: token!,
    roomPassword: currentRoomPassword || undefined,
    onKicked,
  });

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const handleDisconnect = () => {
    leaveRoom();
    navigate("/lobby");
  };

  return (
    <div id="chat-screen" className="screen">
      <ChatView
        send={send}
        roomName={currentRoomName || `Room ${roomId}`}
        currentUser={user!}
        onDisconnect={handleDisconnect}
      />
      {profileOpen && <ProfileModal />}
      {userCardUserId !== null && <UserCard />}
      {privateChatUserId !== null && <PrivateChat send={send} currentUser={user!} />}
      <ImageModal />
      <DmInboxModal send={send} />
    </div>
  );
}

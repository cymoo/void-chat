import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRoomStore } from "@/stores/roomStore";
import { ChatView } from "@/components/chat/ChatView";
import { UserCard } from "@/components/profile/UserCard";
import { ProfileModal } from "@/components/profile/ProfileModal";

export function ChatPage() {
  const { roomId: roomIdParam } = useParams<{ roomId: string }>();
  const roomId = Number(roomIdParam);
  const navigate = useNavigate();
  const currentRoomId = useRoomStore((s) => s.currentRoomId);
  const joinRoom = useRoomStore((s) => s.joinRoom);

  // If navigated directly (no room in store), set a default
  useEffect(() => {
    if (!currentRoomId && roomId) {
      joinRoom(roomId, `Room ${roomId}`);
    }
  }, [currentRoomId, roomId, joinRoom]);

  // Invalid room ID
  useEffect(() => {
    if (isNaN(roomId)) {
      navigate("/lobby");
    }
  }, [roomId, navigate]);

  if (isNaN(roomId)) return null;

  return (
    <>
      <ChatView />
      <UserCard />
      <ProfileModal />
    </>
  );
}

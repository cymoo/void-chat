import { useChatStore } from "@/stores/chatStore";

interface TypingIndicatorProps {
  currentUserId: number;
}

export function TypingIndicator({ currentUserId }: TypingIndicatorProps) {
  const typingUsers = useChatStore((s) => s.typingUsers);
  const active = typingUsers.filter((u) => u.userId !== currentUserId);
  if (active.length === 0) return null;

  const text =
    active.length === 1
      ? `${active[0]!.username} is typing...`
      : active.length === 2
        ? `${active[0]!.username} and ${active[1]!.username} are typing...`
        : `${active.length} people are typing...`;

  return <div className="typing-indicator">{text}</div>;
}

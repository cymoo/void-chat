import { useMemo } from "react";
import { useChatStore } from "@/stores/chatStore";

interface TypingIndicatorProps {
  currentUserId: number;
}

export function TypingIndicator({ currentUserId }: TypingIndicatorProps) {
  const typingUsers = useChatStore((s) => s.typingUsers);
  const active = useMemo(
    () => typingUsers.filter((u) => u.userId !== currentUserId),
    [typingUsers, currentUserId],
  );

  const text =
    active.length === 1
      ? `${active[0]!.username} is typing...`
      : active.length === 2
        ? `${active[0]!.username} and ${active[1]!.username} are typing...`
        : active.length > 2
          ? `${active.length} people are typing...`
          : null;

  return (
    <div className={`typing-indicator${text ? " typing-visible" : ""}`}>
      {text}
    </div>
  );
}

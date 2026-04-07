const JUMP_TO_MESSAGE_EVENT = "chat:jump-to-message";

interface JumpToMessageDetail {
  messageId: number;
}

export function requestMessageJump(messageId: number) {
  window.dispatchEvent(
    new CustomEvent<JumpToMessageDetail>(JUMP_TO_MESSAGE_EVENT, {
      detail: { messageId },
    }),
  );
}

export function onMessageJump(handler: (messageId: number) => void): () => void {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<JumpToMessageDetail>;
    const targetId = customEvent.detail?.messageId;
    if (typeof targetId === "number") {
      handler(targetId);
    }
  };

  window.addEventListener(JUMP_TO_MESSAGE_EVENT, listener);
  return () => window.removeEventListener(JUMP_TO_MESSAGE_EVENT, listener);
}

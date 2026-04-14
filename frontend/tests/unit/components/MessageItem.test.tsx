import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import { MessageItem } from "@/components/chat/MessageItem";
import type { ChatMessage, WsSendPayload } from "@/api/types";

const NOW = Date.now();

function makeTextMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 1,
    messageType: "text",
    userId: 2,
    username: "alice",
    content: "Hello world",
    timestamp: NOW,
    editedAt: null,
    replyTo: null,
    ...overrides,
  } as ChatMessage;
}

function makeImageMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 2,
    messageType: "image",
    userId: 2,
    username: "alice",
    imageUrl: "/uploads/test.png",
    timestamp: NOW,
    replyTo: null,
    ...overrides,
  } as ChatMessage;
}

function defaultProps(message: ChatMessage, currentUserId = 99) {
  return {
    message,
    currentUserId,
    currentUsername: "me",
    send: vi.fn() as (payload: WsSendPayload) => void,
  };
}

describe("MessageItem", () => {
  beforeEach(() => {
    useChatStore.setState({ editingMessageId: null, replyingTo: null });
    useUiStore.setState({ confirmDialog: null, userCardUserId: null, imageModalUrl: null });
  });

  it("renders text message content", () => {
    const msg = makeTextMessage({ content: "Hello world" });
    render(<MessageItem {...defaultProps(msg)} />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders image for image messages", () => {
    const msg = makeImageMessage();
    render(<MessageItem {...defaultProps(msg)} />);
    const img = screen.getByAltText("Shared image");
    expect(img).toHaveAttribute("src", "/uploads/test.png");
  });

  it("shows (edited) badge when editedAt is set", () => {
    const msg = makeTextMessage({ editedAt: NOW - 1000 });
    render(<MessageItem {...defaultProps(msg)} />);
    expect(screen.getByText("(edited)")).toBeInTheDocument();
  });

  it("does not show edit/delete buttons for other users' messages", () => {
    const msg = makeTextMessage({ userId: 2 });
    render(<MessageItem {...defaultProps(msg, 99)} />);
    expect(screen.queryByLabelText("Edit message")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Delete message")).not.toBeInTheDocument();
  });

  it("shows edit/delete buttons for own messages", () => {
    // Message must be recent (within 5 min edit window)
    const msg = makeTextMessage({ userId: 1, timestamp: Date.now() });
    render(<MessageItem {...defaultProps(msg, 1)} />);
    expect(screen.getByLabelText("Edit message")).toBeInTheDocument();
    expect(screen.getByLabelText("Delete message")).toBeInTheDocument();
  });
});

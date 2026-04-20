import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useChatStore } from "@/stores/chatStore";
import { TypingIndicator } from "@/components/chat/TypingIndicator";

describe("TypingIndicator", () => {
  beforeEach(() => {
    useChatStore.setState({ typingUsers: [] });
  });

  it("renders empty container when no one is typing", () => {
    const { container } = render(<TypingIndicator currentUserId={1} />);
    const el = container.firstChild as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.textContent).toBe("");
    expect(el.classList.contains("typing-visible")).toBe(false);
  });

  it("shows '<name> is typing...' for one other user", () => {
    useChatStore.setState({
      typingUsers: [{ userId: 2, username: "alice" }],
    });
    render(<TypingIndicator currentUserId={1} />);
    expect(screen.getByText("alice is typing...")).toBeInTheDocument();
  });

  it("shows '<a> and <b> are typing...' for two users", () => {
    useChatStore.setState({
      typingUsers: [
        { userId: 2, username: "alice" },
        { userId: 3, username: "bob" },
      ],
    });
    render(<TypingIndicator currentUserId={1} />);
    expect(screen.getByText("alice and bob are typing...")).toBeInTheDocument();
  });

  it("shows 'N people are typing...' for 3+ users", () => {
    useChatStore.setState({
      typingUsers: [
        { userId: 2, username: "alice" },
        { userId: 3, username: "bob" },
        { userId: 4, username: "carol" },
      ],
    });
    render(<TypingIndicator currentUserId={1} />);
    expect(screen.getByText("3 people are typing...")).toBeInTheDocument();
  });

  it("excludes current user from typing display", () => {
    useChatStore.setState({
      typingUsers: [{ userId: 1, username: "me" }],
    });
    const { container } = render(<TypingIndicator currentUserId={1} />);
    const el = container.firstChild as HTMLElement;
    expect(el.textContent).toBe("");
    expect(el.classList.contains("typing-visible")).toBe(false);
  });
});

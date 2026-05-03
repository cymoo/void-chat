import { describe, it, expect, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { useChatStore } from "@/stores/chatStore";

describe("TypingIndicator fade animation", () => {
  beforeEach(() => {
    useChatStore.setState({ typingUsers: [] });
  });

  it("does not have typing-visible class when nobody is typing", () => {
    const { container } = render(<TypingIndicator currentUserId={1} />);
    const el = container.firstChild as HTMLElement;
    expect(el.classList.contains("typing-visible")).toBe(false);
  });

  it("has typing-visible class when someone is typing", () => {
    useChatStore.setState({
      typingUsers: [{ userId: 2, username: "alice" }],
    });
    const { container } = render(<TypingIndicator currentUserId={1} />);
    const el = container.firstChild as HTMLElement;
    expect(el.classList.contains("typing-visible")).toBe(true);
  });

  it("toggles typing-visible class dynamically", () => {
    const { container, rerender } = render(<TypingIndicator currentUserId={1} />);
    const el = container.firstChild as HTMLElement;
    expect(el.classList.contains("typing-visible")).toBe(false);

    act(() => {
      useChatStore.setState({
        typingUsers: [{ userId: 2, username: "alice" }],
      });
    });
    rerender(<TypingIndicator currentUserId={1} />);
    expect(el.classList.contains("typing-visible")).toBe(true);

    act(() => {
      useChatStore.setState({ typingUsers: [] });
    });
    rerender(<TypingIndicator currentUserId={1} />);
    expect(el.classList.contains("typing-visible")).toBe(false);
  });
});

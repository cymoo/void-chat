import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmojiPicker } from "@/components/shared/EmojiPicker";
import { COMMON_EMOJIS } from "@/lib/emojis";

describe("EmojiPicker", () => {
  it("renders toggle button when closed", () => {
    render(<EmojiPicker open={false} onToggle={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Insert emoji" })).toBeInTheDocument();
  });

  it("does not render grid when open is false", () => {
    render(<EmojiPicker open={false} onToggle={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.queryByRole("menu", { name: "Emoji picker" })).not.toBeInTheDocument();
  });

  it("opens emoji grid when toggle clicked", () => {
    const onToggle = vi.fn();
    render(<EmojiPicker open={false} onToggle={onToggle} onSelect={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Insert emoji" }));
    // Floating UI's useClick passes (open, event, reason) — just verify first arg
    expect(onToggle).toHaveBeenCalled();
    expect(onToggle.mock.calls[0]![0]).toBe(true);
  });

  it("renders emoji grid with all emojis when open", () => {
    render(<EmojiPicker open={true} onToggle={vi.fn()} onSelect={vi.fn()} />);

    expect(screen.getByRole("menu", { name: "Emoji picker" })).toBeInTheDocument();
    const emojiButtons = screen.getAllByRole("button").filter(
      (btn) => btn.className === "emoji-btn",
    );
    expect(emojiButtons).toHaveLength(COMMON_EMOJIS.length);
  });

  it("calls onSelect with emoji when emoji button clicked", () => {
    const onSelect = vi.fn();
    render(<EmojiPicker open={true} onToggle={vi.fn()} onSelect={onSelect} />);

    const firstEmoji = COMMON_EMOJIS[0];
    const emojiButtons = screen.getAllByRole("button").filter(
      (btn) => btn.textContent === firstEmoji,
    );
    fireEvent.click(emojiButtons[0]!);
    expect(onSelect).toHaveBeenCalledWith(firstEmoji);
  });

  it("calls onToggle(false) on outside click when open", () => {
    const onToggle = vi.fn();
    render(<EmojiPicker open={true} onToggle={onToggle} onSelect={vi.fn()} />);

    // Floating UI's useDismiss listens to pointerdown, not mousedown
    fireEvent.pointerDown(document.body);
    expect(onToggle).toHaveBeenCalled();
    expect(onToggle.mock.calls[0]![0]).toBe(false);
  });
});

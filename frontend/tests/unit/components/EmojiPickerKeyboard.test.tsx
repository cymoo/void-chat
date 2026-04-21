import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmojiPicker } from "@/components/shared/EmojiPicker";
import { COMMON_EMOJIS } from "@/lib/emojis";

describe("EmojiPicker keyboard navigation", () => {
  it("moves focus right with ArrowRight", () => {
    const onSelect = vi.fn();
    render(<EmojiPicker open={true} onToggle={vi.fn()} onSelect={onSelect} />);

    const grid = screen.getByRole("grid");
    // First emoji should have focus indicator initially
    const firstBtn = screen.getAllByRole("button").find(
      (btn) => btn.textContent === COMMON_EMOJIS[0],
    )!;
    expect(firstBtn.classList.contains("emoji-btn-focused")).toBe(true);

    // Press ArrowRight → focus moves to second emoji
    fireEvent.keyDown(grid, { key: "ArrowRight" });
    const secondBtn = screen.getAllByRole("button").find(
      (btn) => btn.textContent === COMMON_EMOJIS[1],
    )!;
    expect(secondBtn.classList.contains("emoji-btn-focused")).toBe(true);
    expect(firstBtn.classList.contains("emoji-btn-focused")).toBe(false);
  });

  it("selects emoji with Enter key", () => {
    const onSelect = vi.fn();
    render(<EmojiPicker open={true} onToggle={vi.fn()} onSelect={onSelect} />);

    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(COMMON_EMOJIS[0]);
  });

  it("selects emoji with Space key", () => {
    const onSelect = vi.fn();
    render(<EmojiPicker open={true} onToggle={vi.fn()} onSelect={onSelect} />);

    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: " " });
    expect(onSelect).toHaveBeenCalledWith(COMMON_EMOJIS[0]);
  });

  it("closes picker with Escape key", () => {
    const onToggle = vi.fn();
    render(<EmojiPicker open={true} onToggle={onToggle} onSelect={vi.fn()} />);

    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: "Escape" });
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it("moves focus down with ArrowDown", () => {
    const onSelect = vi.fn();
    render(<EmojiPicker open={true} onToggle={vi.fn()} onSelect={onSelect} />);

    const grid = screen.getByRole("grid");
    // ArrowDown should move by COLS (5, matching grid-template-columns: repeat(5, ...))
    fireEvent.keyDown(grid, { key: "ArrowDown" });
    const targetIdx = Math.min(5, COMMON_EMOJIS.length - 1);
    const targetBtn = screen.getAllByRole("button").find(
      (btn) => btn.textContent === COMMON_EMOJIS[targetIdx],
    )!;
    expect(targetBtn.classList.contains("emoji-btn-focused")).toBe(true);
  });
});

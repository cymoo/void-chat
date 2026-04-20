import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MentionDropdown } from "@/components/shared/MentionDropdown";
import type { User } from "@/api/types";

function makeUser(overrides: Partial<User> & { id: number; username: string }): User {
  return {
    createdAt: Date.now(),
    lastSeen: Date.now(),
    ...overrides,
  };
}

const users: User[] = [
  makeUser({ id: 1, username: "alice" }),
  makeUser({ id: 2, username: "bob" }),
  makeUser({ id: 3, username: "charlie" }),
];

describe("MentionDropdown", () => {
  it("returns null when results is empty", () => {
    const { container } = render(
      <MentionDropdown results={[]} selectedIndex={0} onSelect={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders all results", () => {
    render(
      <MentionDropdown results={users} selectedIndex={0} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getByText("charlie")).toBeInTheDocument();
  });

  it("highlights selected index item", () => {
    render(
      <MentionDropdown results={users} selectedIndex={1} onSelect={vi.fn()} />,
    );
    const items = document.querySelectorAll(".mention-item");
    expect(items[0]).not.toHaveClass("selected");
    expect(items[1]).toHaveClass("selected");
    expect(items[2]).not.toHaveClass("selected");
  });

  it("calls onSelect with username when item clicked", () => {
    const onSelect = vi.fn();
    render(
      <MentionDropdown results={users} selectedIndex={0} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByText("bob"));
    expect(onSelect).toHaveBeenCalledWith("bob");
  });

  it("calls onClose when clicking outside the dropdown", () => {
    const onClose = vi.fn();
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <MentionDropdown results={users} selectedIndex={0} onSelect={vi.fn()} onClose={onClose} />
      </div>,
    );
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(onClose).toHaveBeenCalled();
  });

  it("does not call onClose when clicking inside the dropdown", () => {
    const onClose = vi.fn();
    render(
      <MentionDropdown results={users} selectedIndex={0} onSelect={vi.fn()} onClose={onClose} />,
    );
    fireEvent.mouseDown(screen.getByText("alice"));
    expect(onClose).not.toHaveBeenCalled();
  });
});

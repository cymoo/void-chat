import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InvitePersonaModal } from "@/components/chat/InvitePersonaModal";
import { useUiStore } from "@/stores/uiStore";

vi.mock("@/api/client", () => ({
  invitePersona: vi.fn(),
}));

import { invitePersona } from "@/api/client";
const mockInvitePersona = vi.mocked(invitePersona);

describe("InvitePersonaModal", () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({ toasts: [] });
  });

  function renderModal() {
    return render(
      <InvitePersonaModal roomId={1} onClose={onClose} onSuccess={onSuccess} />,
    );
  }

  it("renders the form with name and personality inputs", () => {
    renderModal();
    expect(screen.getByText("INVITE AI PERSONA")).toBeInTheDocument();
    expect(screen.getByLabelText(/PERSONA NAME/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Schopenhauer/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/pirate/)).toBeInTheDocument();
  });

  it("submit button is disabled when name is empty", () => {
    renderModal();
    const btn = screen.getByRole("button", { name: /INVOKE PERSONA/i });
    expect(btn).toBeDisabled();
  });

  it("submit button is enabled when name is filled", () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/PERSONA NAME/), {
      target: { value: "牛顿" },
    });
    const btn = screen.getByRole("button", { name: /INVOKE PERSONA/i });
    expect(btn).toBeEnabled();
  });

  it("calls invitePersona API on form submit", async () => {
    mockInvitePersona.mockResolvedValue({
      success: true,
      displayName: "牛顿",
      bio: "英国物理学家",
      userId: 5,
    });

    renderModal();
    fireEvent.change(screen.getByLabelText(/PERSONA NAME/), {
      target: { value: "牛顿" },
    });
    fireEvent.change(
      screen.getByPlaceholderText(/pirate/),
      { target: { value: "幽默一些" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /INVOKE PERSONA/i }));

    await waitFor(() => {
      expect(mockInvitePersona).toHaveBeenCalledWith(1, {
        name: "牛顿",
        personality: "幽默一些",
      });
    });
  });

  it("shows loading state while summoning", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolvePromise: (v: any) => void;
    mockInvitePersona.mockReturnValue(
      new Promise((r) => { resolvePromise = r; }) as ReturnType<typeof invitePersona>,
    );

    renderModal();
    fireEvent.change(screen.getByLabelText(/PERSONA NAME/), {
      target: { value: "孔子" },
    });
    fireEvent.click(screen.getByRole("button", { name: /INVOKE PERSONA/i }));

    await waitFor(() => {
      expect(screen.getByText("SUMMONING...")).toBeInTheDocument();
    });

    resolvePromise!({ success: true, displayName: "孔子", bio: "...", userId: 5 });
  });

  it("shows success result when persona is recognized", async () => {
    mockInvitePersona.mockResolvedValue({
      success: true,
      displayName: "叔本华",
      bio: "德国悲观主义哲学家",
      userId: 5,
    });

    renderModal();
    fireEvent.change(screen.getByLabelText(/PERSONA NAME/), {
      target: { value: "叔本华" },
    });
    fireEvent.click(screen.getByRole("button", { name: /INVOKE PERSONA/i }));

    await waitFor(() => {
      expect(screen.getByText("叔本华")).toBeInTheDocument();
      expect(screen.getByText("德国悲观主义哲学家")).toBeInTheDocument();
      expect(screen.getByText("Joined the room!")).toBeInTheDocument();
    });
  });

  it("shows error toast when persona is not recognized", async () => {
    mockInvitePersona.mockResolvedValue({
      success: false,
      error: "Unable to recognize",
    });

    renderModal();
    fireEvent.change(screen.getByLabelText(/PERSONA NAME/), {
      target: { value: "nobody" },
    });
    fireEvent.click(screen.getByRole("button", { name: /INVOKE PERSONA/i }));

    await waitFor(() => {
      const toasts = useUiStore.getState().toasts;
      expect(toasts.some((t) => t.type === "error")).toBe(true);
    });
  });

  it("shows error toast on network failure", async () => {
    mockInvitePersona.mockRejectedValue(new Error("Network error"));

    renderModal();
    fireEvent.change(screen.getByLabelText(/PERSONA NAME/), {
      target: { value: "牛顿" },
    });
    fireEvent.click(screen.getByRole("button", { name: /INVOKE PERSONA/i }));

    await waitFor(() => {
      const toasts = useUiStore.getState().toasts;
      expect(toasts.some((t) => t.message === "Network error")).toBe(true);
    });
  });

  it("calls onClose when close button is clicked", () => {
    renderModal();
    fireEvent.click(screen.getByLabelText("Close persona dialog"));
    expect(onClose).toHaveBeenCalled();
  });

  it("sends null personality when field is empty", async () => {
    mockInvitePersona.mockResolvedValue({
      success: true,
      displayName: "牛顿",
      bio: "...",
      userId: 5,
    });

    renderModal();
    fireEvent.change(screen.getByLabelText(/PERSONA NAME/), {
      target: { value: "牛顿" },
    });
    // Don't fill personality
    fireEvent.click(screen.getByRole("button", { name: /INVOKE PERSONA/i }));

    await waitFor(() => {
      expect(mockInvitePersona).toHaveBeenCalledWith(1, {
        name: "牛顿",
        personality: null,
      });
    });
  });
});

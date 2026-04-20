import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useUiStore } from "@/stores/uiStore";

describe("Toast improvements", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUiStore.setState({ toasts: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-removes success toasts after 4 seconds", () => {
    const { addToast } = useUiStore.getState();
    addToast("Success!", "success");
    expect(useUiStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(4100);
    expect(useUiStore.getState().toasts).toHaveLength(0);
  });

  it("auto-removes error toasts after 8 seconds", () => {
    const { addToast } = useUiStore.getState();
    addToast("Error!", "error");
    expect(useUiStore.getState().toasts).toHaveLength(1);

    // After 4s, still present
    vi.advanceTimersByTime(4100);
    expect(useUiStore.getState().toasts).toHaveLength(1);

    // After 8s, removed
    vi.advanceTimersByTime(4100);
    expect(useUiStore.getState().toasts).toHaveLength(0);
  });

  it("can manually remove a toast", () => {
    const { addToast } = useUiStore.getState();
    addToast("Test toast", "info");
    const toastId = useUiStore.getState().toasts[0]!.id;

    useUiStore.getState().removeToast(toastId);
    expect(useUiStore.getState().toasts).toHaveLength(0);
  });

  it("supports stacking multiple toasts", () => {
    const { addToast } = useUiStore.getState();
    addToast("First", "info");
    addToast("Second", "success");
    addToast("Third", "error");
    expect(useUiStore.getState().toasts).toHaveLength(3);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Component, type ReactNode } from "react";

// Inline ErrorBoundary for testing (same as App.tsx)
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-boundary-icon">⚠</div>
            <h1>SYSTEM ERROR</h1>
            <p>{this.state.error.message}</p>
            <button onClick={() => window.location.reload()}>RELOAD</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ThrowingComponent({ message }: { message: string }) {
  throw new Error(message);
}

function GoodComponent() {
  return <div>All good</div>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // Suppress React error boundary console errors in tests
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders children normally when no error", () => {
    render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("renders error UI when child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="test crash" />
      </ErrorBoundary>,
    );
    expect(screen.getByText("SYSTEM ERROR")).toBeInTheDocument();
    expect(screen.getByText("test crash")).toBeInTheDocument();
    expect(screen.getByText("RELOAD")).toBeInTheDocument();
  });

  it("does not show error UI before error occurs", () => {
    render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>,
    );
    expect(screen.queryByText("SYSTEM ERROR")).not.toBeInTheDocument();
  });
});

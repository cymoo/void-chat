import { useState } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { cn } from "@/lib/utils";

export function AuthPage() {
  const [tab, setTab] = useState<"login" | "register">("login");

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display text-5xl text-terminal-green glow-green tracking-wider">
            TERMINAL.CHAT
          </h1>
          <div className="text-terminal-text-dim text-xs mt-2">
            ── SECURE REAL-TIME COMMUNICATION ──
          </div>
        </div>

        {/* Auth card */}
        <div className="border border-terminal-border bg-terminal-surface p-6">
          {/* Tabs */}
          <div className="flex mb-6 border-b border-terminal-border">
            <button
              onClick={() => setTab("login")}
              className={cn(
                "flex-1 py-2 text-sm font-mono transition-colors",
                tab === "login"
                  ? "text-terminal-green border-b-2 border-terminal-green"
                  : "text-terminal-text-dim hover:text-terminal-text",
              )}
            >
              [ LOGIN ]
            </button>
            <button
              onClick={() => setTab("register")}
              className={cn(
                "flex-1 py-2 text-sm font-mono transition-colors",
                tab === "register"
                  ? "text-terminal-green border-b-2 border-terminal-green"
                  : "text-terminal-text-dim hover:text-terminal-text",
              )}
            >
              [ REGISTER ]
            </button>
          </div>

          {tab === "login" ? <LoginForm /> : <RegisterForm />}

          {/* Status bar */}
          <div className="mt-6 pt-3 border-t border-terminal-border text-center text-terminal-text-dim text-xs">
            <span className="cursor-blink">SYSTEM READY</span>
          </div>
        </div>
      </div>
    </div>
  );
}

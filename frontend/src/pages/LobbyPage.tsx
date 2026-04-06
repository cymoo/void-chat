import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import { RoomList } from "@/components/lobby/RoomList";
import { CreateRoomDialog } from "@/components/lobby/CreateRoomDialog";
import { ProfileModal } from "@/components/profile/ProfileModal";

export function LobbyPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setCreateRoomOpen = useUiStore((s) => s.setCreateRoomOpen);
  const setProfileOpen = useUiStore((s) => s.setProfileOpen);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-terminal-border bg-terminal-surface px-6 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <h1 className="font-display text-2xl text-terminal-green tracking-wider">
            TERMINAL.CHAT
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setProfileOpen(true)}
              className="text-terminal-text text-sm hover:text-terminal-green transition-colors"
            >
              {user?.username ?? "USER"}
            </button>
            <button
              onClick={logout}
              className="text-terminal-text-dim text-sm hover:text-terminal-red transition-colors"
            >
              [LOGOUT]
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-6 py-6">
        <div className="max-w-4xl mx-auto">
          {/* Room controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-terminal-green text-sm">
              ┌── AVAILABLE ROOMS ──┐
            </div>
            <button
              onClick={() => setCreateRoomOpen(true)}
              className="border border-terminal-green text-terminal-green px-3 py-1 text-xs hover:bg-terminal-green hover:text-terminal-bg transition-colors"
            >
              [ + NEW ROOM ]
            </button>
          </div>

          <RoomList />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-terminal-border px-6 py-2 text-center text-terminal-text-dim text-xs">
        TERMINAL.CHAT v0.0.1 — Secure Communication Protocol
      </footer>

      {/* Dialogs */}
      <CreateRoomDialog />
      <ProfileModal />
    </div>
  );
}

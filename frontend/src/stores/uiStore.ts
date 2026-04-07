import { create } from "zustand";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ConfirmDialog {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  tone: "default" | "danger";
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmDialog["tone"];
}

interface UiState {
  searchOpen: boolean;
  profileOpen: boolean;
  createRoomOpen: boolean;
  userCardUserId: number | null;
  imageModalUrl: string | null;
  dmInboxOpen: boolean;
  toasts: Toast[];
  confirmDialog: ConfirmDialog | null;

  toggleSearch: () => void;
  setSearchOpen: (open: boolean) => void;
  setProfileOpen: (open: boolean) => void;
  setCreateRoomOpen: (open: boolean) => void;
  showUserCard: (userId: number) => void;
  hideUserCard: () => void;
  setImageModal: (url: string | null) => void;
  setDmInboxOpen: (open: boolean) => void;
  addToast: (message: string, type?: Toast["type"]) => void;
  removeToast: (id: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  resolveConfirm: (confirmed: boolean) => void;
}

let toastCounter = 0;
let pendingConfirmResolver: ((confirmed: boolean) => void) | null = null;

export const useUiStore = create<UiState>((set) => ({
  searchOpen: false,
  profileOpen: false,
  createRoomOpen: false,
  userCardUserId: null,
  imageModalUrl: null,
  dmInboxOpen: false,
  toasts: [],
  confirmDialog: null,

  toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen })),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setProfileOpen: (open) => set({ profileOpen: open }),
  setCreateRoomOpen: (open) => set({ createRoomOpen: open }),
  showUserCard: (userId) => set({ userCardUserId: userId }),
  hideUserCard: () => set({ userCardUserId: null }),
  setImageModal: (url) => set({ imageModalUrl: url }),
  setDmInboxOpen: (open) => set({ dmInboxOpen: open }),

  addToast: (message, type = "info") => {
    const id = `toast-${++toastCounter}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  confirm: (options) =>
    new Promise((resolve) => {
      pendingConfirmResolver?.(false);
      pendingConfirmResolver = resolve;
      set({
        confirmDialog: {
          title: options.title,
          message: options.message,
          confirmText: options.confirmText ?? "CONFIRM",
          cancelText: options.cancelText ?? "CANCEL",
          tone: options.tone ?? "default",
        },
      });
    }),

  resolveConfirm: (confirmed) => {
    const resolver = pendingConfirmResolver;
    pendingConfirmResolver = null;
    set({ confirmDialog: null });
    resolver?.(confirmed);
  },
}));

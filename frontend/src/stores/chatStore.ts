import { create } from "zustand";
import type {
  ChatMessage,
  User,
  PrivateMessage,
  WsEvent,
  TextMessage,
} from "@/api/types";

interface ChatState {
  messages: ChatMessage[];
  users: User[];
  hasMore: boolean;
  oldestMessageId: number | null;

  // Private messages
  privateChatUserId: number | null;
  privateChatUsername: string;
  privateMessages: PrivateMessage[];
  privateHasMore: boolean;
  unreadDmCount: number;

  // Search
  searchResults: ChatMessage[];
  searchQuery: string;

  // Edit / reply state
  editingMessageId: number | null;
  replyingTo: ChatMessage | null;

  // Actions
  handleWsEvent: (event: WsEvent) => void;
  setMessages: (messages: ChatMessage[], hasMore: boolean) => void;
  addMessage: (message: ChatMessage) => void;
  prependMessages: (messages: ChatMessage[], hasMore: boolean) => void;
  setUsers: (users: User[]) => void;
  setEditingMessage: (id: number | null) => void;
  setReplyingTo: (msg: ChatMessage | null) => void;
  openPrivateChat: (userId: number, username: string) => void;
  closePrivateChat: () => void;
  setSearchResults: (messages: ChatMessage[], query: string) => void;
  clearSearch: () => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  users: [],
  hasMore: false,
  oldestMessageId: null,
  privateChatUserId: null,
  privateChatUsername: "",
  privateMessages: [],
  privateHasMore: false,
  unreadDmCount: 0,
  searchResults: [],
  searchQuery: "",
  editingMessageId: null,
  replyingTo: null,

  handleWsEvent: (event: WsEvent) => {
    switch (event.type) {
      case "history":
        set({
          messages: event.messages,
          hasMore: event.hasMore,
          oldestMessageId:
            event.messages.length > 0 ? event.messages[0]!.id : null,
        });
        break;

      case "users":
        set({ users: event.users });
        break;

      case "message":
        set((state) => ({
          messages: [...state.messages, event.message],
        }));
        break;

      case "user_joined":
        set((state) => {
          const exists = state.users.some((u) => u.id === event.user.id);
          return {
            users: exists ? state.users : [...state.users, event.user],
          };
        });
        break;

      case "user_left":
        set((state) => ({
          users: state.users.filter((u) => u.id !== event.userId),
        }));
        break;

      case "message_edited":
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === event.messageId && m.messageType === "text"
              ? { ...m, content: event.content, editedAt: event.editedAt }
              : m,
          ),
        }));
        break;

      case "message_deleted":
        set((state) => ({
          messages: state.messages.filter((m) => m.id !== event.messageId),
        }));
        break;

      case "private_message":
        set((state) => {
          const { privateChatUserId } = state;
          const msg = event.message;
          if (
            privateChatUserId === msg.senderId ||
            privateChatUserId === msg.receiverId
          ) {
            return {
              privateMessages: [...state.privateMessages, msg],
              unreadDmCount: state.unreadDmCount,
            };
          }
          return { unreadDmCount: state.unreadDmCount + 1 };
        });
        break;

      case "private_history":
        set({
          privateMessages: event.messages,
          privateHasMore: event.hasMore,
        });
        break;

      case "user_updated":
        set((state) => ({
          users: state.users.map((u) =>
            u.id === event.user.id ? event.user : u,
          ),
          messages: state.messages.map((m) => {
            if ("userId" in m && m.userId === event.user.id) {
              return {
                ...m,
                username: event.user.username,
                avatarUrl: event.user.avatarUrl,
              };
            }
            return m;
          }),
        }));
        break;

      case "kicked":
        // Handled by the component that manages navigation
        break;

      case "role_changed":
        set((state) => ({
          users: state.users.map((u) =>
            u.id === event.userId ? { ...u, role: event.role } : u,
          ),
        }));
        break;

      case "search_results":
        set({
          searchResults: event.messages,
          searchQuery: event.query,
        });
        break;

      case "unread_counts":
        set({ unreadDmCount: event.unreadDms });
        break;

      case "mention":
        // Handled by toast notification in component
        break;

      case "error":
        // Handled by toast notification in component
        break;
    }
  },

  setMessages: (messages, hasMore) =>
    set({
      messages,
      hasMore,
      oldestMessageId: messages.length > 0 ? messages[0]!.id : null,
    }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  prependMessages: (messages, hasMore) =>
    set((state) => ({
      messages: [...messages, ...state.messages],
      hasMore,
      oldestMessageId: messages.length > 0 ? messages[0]!.id : state.oldestMessageId,
    })),

  setUsers: (users) => set({ users }),

  setEditingMessage: (id) => {
    if (id !== null) {
      const msg = get().messages.find((m) => m.id === id);
      if (msg && msg.messageType === "text") {
        set({ editingMessageId: id, replyingTo: null });
        return;
      }
    }
    set({ editingMessageId: null });
  },

  setReplyingTo: (msg) => set({ replyingTo: msg, editingMessageId: null }),

  openPrivateChat: (userId, username) =>
    set({
      privateChatUserId: userId,
      privateChatUsername: username,
      privateMessages: [],
      privateHasMore: false,
    }),

  closePrivateChat: () =>
    set({
      privateChatUserId: null,
      privateChatUsername: "",
      privateMessages: [],
      privateHasMore: false,
    }),

  setSearchResults: (messages, query) =>
    set({ searchResults: messages, searchQuery: query }),

  clearSearch: () => set({ searchResults: [], searchQuery: "" }),

  reset: () =>
    set({
      messages: [],
      users: [],
      hasMore: false,
      oldestMessageId: null,
      privateChatUserId: null,
      privateChatUsername: "",
      privateMessages: [],
      privateHasMore: false,
      unreadDmCount: 0,
      searchResults: [],
      searchQuery: "",
      editingMessageId: null,
      replyingTo: null,
    }),
}));

// Helper to get a text message's content for editing
export function getMessageContent(msg: ChatMessage): string {
  if (msg.messageType === "text") return (msg as TextMessage).content;
  return "";
}

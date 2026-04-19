import { create } from "zustand";
import type {
  ChatMessage,
  User,
  PrivateMessage,
  WsEvent,
  TextMessage,
} from "@/api/types";

function mergeUniqueById<T extends { id: number }>(items: T[]): T[] {
  const seen = new Set<number>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function clearReplyReference(
  messages: ChatMessage[],
  deletedMessageId: number,
): ChatMessage[] {
  return messages.map((message) => {
    if (message.replyTo?.id !== deletedMessageId) return message;
    return { ...message, replyTo: null };
  });
}

interface ChatState {
  messages: ChatMessage[];
  users: User[];
  typingUsers: { userId: number; username: string }[];
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

  // WebSocket error
  wsError: string | null;

  // Initial load tracking
  initialLoaded: boolean;

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
  setUnreadDmCount: (count: number) => void;
  clearWsError: () => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  users: [],
  typingUsers: [],
  hasMore: false,
  oldestMessageId: null,
  wsError: null,
  initialLoaded: false,
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
        set((state) => {
          const incoming = mergeUniqueById(event.messages);
          if (state.messages.length === 0) {
            return {
              messages: incoming,
              hasMore: event.hasMore,
              oldestMessageId: incoming.length > 0 ? incoming[0]!.id : null,
              initialLoaded: true,
            };
          }

          const knownIds = new Set(state.messages.map((m) => m.id));
          const freshIncoming = incoming.filter((m) => !knownIds.has(m.id));
          const oldestCurrent = state.messages[0]?.id ?? null;
          const newestIncoming = incoming[incoming.length - 1]?.id ?? null;
          const prependHistory =
            oldestCurrent !== null &&
            newestIncoming !== null &&
            newestIncoming < oldestCurrent;

          const merged = prependHistory
            ? [...freshIncoming, ...state.messages]
            : mergeUniqueById([...state.messages, ...incoming]);

          return {
            messages: merged,
            hasMore: event.hasMore,
            oldestMessageId: merged.length > 0 ? merged[0]!.id : null,
            initialLoaded: true,
          };
        });
        break;

      case "users":
        set((state) => ({
          users: event.users,
          typingUsers: state.typingUsers.filter((typingUser) =>
            event.users.some((u) => u.id === typingUser.userId),
          ),
        }));
        break;

      case "message":
        {
          const messageUserId =
            event.message.messageType === "system" ? null : event.message.userId;
          set((state) => {
            if (state.messages.some((m) => m.id === event.message.id)) {
              return state;
            }
            return { messages: [...state.messages, event.message] };
          });
          if (messageUserId !== null) {
            set((state) => ({
              typingUsers: state.typingUsers.filter(
                (typingUser) => typingUser.userId !== messageUserId,
              ),
            }));
          }
          break;
        }

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
          typingUsers: state.typingUsers.filter(
            (typingUser) => typingUser.userId !== event.userId,
          ),
        }));
        break;

      case "message_edited":
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === event.messageId
              ? m.messageType === "text"
                ? { ...m, content: event.content, editedAt: event.editedAt }
                : m
              : m.replyTo?.id === event.messageId
                ? {
                    ...m,
                    replyTo: {
                      ...m.replyTo,
                      content: event.content,
                    },
                  }
                : m,
          ),
        }));
        break;

      case "message_deleted":
        set((state) => {
          const remaining = state.messages.filter((m) => m.id !== event.messageId);
          return {
            messages: clearReplyReference(remaining, event.messageId),
            oldestMessageId: remaining.length > 0 ? remaining[0]!.id : null,
          };
        });
        break;

      case "private_message":
        set((state) => {
          const { privateChatUserId } = state;
          const msg = event.message;
          if (
            privateChatUserId === msg.senderId ||
            privateChatUserId === msg.receiverId
          ) {
            if (state.privateMessages.some((m) => m.id === msg.id)) {
              return state;
            }
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
          privateMessages: mergeUniqueById(event.messages),
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

      case "typing":
        set((state) => {
          if (!event.isTyping) {
            return {
              typingUsers: state.typingUsers.filter(
                (typingUser) => typingUser.userId !== event.userId,
              ),
            };
          }
          const existing = state.typingUsers.some(
            (typingUser) => typingUser.userId === event.userId,
          );
          if (existing) return state;
          return {
            typingUsers: [
              ...state.typingUsers,
              { userId: event.userId, username: event.username },
            ],
          };
        });
        break;

      case "mention":
        // Handled by toast notification in component
        break;

      case "error":
        set({ wsError: event.message ?? "WebSocket error" });
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

  setUnreadDmCount: (count) => set({ unreadDmCount: count }),

  clearWsError: () => set({ wsError: null }),

  reset: () =>
    set({
      messages: [],
      users: [],
      typingUsers: [],
      hasMore: false,
      oldestMessageId: null,
      wsError: null,
      initialLoaded: false,
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

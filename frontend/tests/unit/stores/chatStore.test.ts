import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "@/stores/chatStore";
import type { ChatMessage, User } from "@/api/types";

describe("chatStore", () => {
  beforeEach(() => {
    useChatStore.getState().reset();
  });

  it("should start with empty state", () => {
    const state = useChatStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.users).toEqual([]);
    expect(state.hasMore).toBe(false);
  });

  it("should handle history event", () => {
    const messages: ChatMessage[] = [
      {
        id: 1,
        messageType: "text",
        userId: 1,
        username: "alice",
        content: "hello",
        timestamp: Date.now(),
      },
      {
        id: 2,
        messageType: "text",
        userId: 2,
        username: "bob",
        content: "hi",
        timestamp: Date.now(),
      },
    ];

    useChatStore.getState().handleWsEvent({
      type: "history",
      messages,
      hasMore: true,
    });

    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(2);
    expect(state.hasMore).toBe(true);
    expect(state.oldestMessageId).toBe(1);
  });

  it("should handle new message event", () => {
    const msg: ChatMessage = {
      id: 3,
      messageType: "text",
      userId: 1,
      username: "alice",
      content: "new message",
      timestamp: Date.now(),
    };

    useChatStore.getState().handleWsEvent({
      type: "message",
      message: msg,
    });

    expect(useChatStore.getState().messages).toHaveLength(1);
    expect(useChatStore.getState().messages[0]!.id).toBe(3);
  });

  it("should handle user_joined event", () => {
    const user: User = {
      id: 1,
      username: "alice",
      createdAt: Date.now(),
      lastSeen: Date.now(),
    };

    useChatStore.getState().handleWsEvent({
      type: "user_joined",
      user,
    });

    expect(useChatStore.getState().users).toHaveLength(1);
  });

  it("should not duplicate users on rejoin", () => {
    const user: User = {
      id: 1,
      username: "alice",
      createdAt: Date.now(),
      lastSeen: Date.now(),
    };

    const store = useChatStore.getState();
    store.handleWsEvent({ type: "user_joined", user });
    store.handleWsEvent({ type: "user_joined", user });

    expect(useChatStore.getState().users).toHaveLength(1);
  });

  it("should handle user_left event", () => {
    useChatStore.setState({
      users: [
        { id: 1, username: "alice", createdAt: 0, lastSeen: 0 },
        { id: 2, username: "bob", createdAt: 0, lastSeen: 0 },
      ],
    });

    useChatStore.getState().handleWsEvent({
      type: "user_left",
      userId: 1,
      username: "alice",
    });

    expect(useChatStore.getState().users).toHaveLength(1);
    expect(useChatStore.getState().users[0]!.username).toBe("bob");
  });

  it("should handle message_edited event", () => {
    useChatStore.setState({
      messages: [
        {
          id: 1,
          messageType: "text",
          userId: 1,
          username: "alice",
          content: "original",
          timestamp: Date.now(),
        },
      ],
    });

    const now = Date.now();
    useChatStore.getState().handleWsEvent({
      type: "message_edited",
      messageId: 1,
      content: "edited",
      editedAt: now,
    });

    const msg = useChatStore.getState().messages[0]!;
    expect(msg.messageType).toBe("text");
    if (msg.messageType === "text") {
      expect(msg.content).toBe("edited");
      expect(msg.editedAt).toBe(now);
    }
  });

  it("should handle message_deleted event", () => {
    useChatStore.setState({
      messages: [
        {
          id: 1,
          messageType: "text",
          userId: 1,
          username: "alice",
          content: "to delete",
          timestamp: Date.now(),
        },
        {
          id: 2,
          messageType: "text",
          userId: 2,
          username: "bob",
          content: "keep",
          timestamp: Date.now(),
        },
      ],
    });

    useChatStore.getState().handleWsEvent({
      type: "message_deleted",
      messageId: 1,
    });

    expect(useChatStore.getState().messages).toHaveLength(1);
    expect(useChatStore.getState().messages[0]!.id).toBe(2);
  });

  it("should clear reply previews that point to deleted message", () => {
    useChatStore.setState({
      messages: [
        {
          id: 1,
          messageType: "text",
          userId: 1,
          username: "alice",
          content: "origin",
          timestamp: Date.now(),
        },
        {
          id: 2,
          messageType: "text",
          userId: 2,
          username: "bob",
          content: "reply",
          timestamp: Date.now(),
          replyTo: { id: 1, username: "alice", content: "origin", messageType: "text" },
        },
      ],
    });

    useChatStore.getState().handleWsEvent({
      type: "message_deleted",
      messageId: 1,
    });

    const remaining = useChatStore.getState().messages[0]!;
    expect(remaining.id).toBe(2);
    expect(remaining.replyTo).toBeNull();
  });

  it("should avoid duplicate messages by id", () => {
    const message: ChatMessage = {
      id: 1,
      messageType: "text",
      userId: 1,
      username: "alice",
      content: "dup",
      timestamp: Date.now(),
    };

    const store = useChatStore.getState();
    store.handleWsEvent({ type: "message", message });
    store.handleWsEvent({ type: "message", message });

    expect(useChatStore.getState().messages).toHaveLength(1);
  });

  it("should handle search_results event", () => {
    const results: ChatMessage[] = [
      {
        id: 5,
        messageType: "text",
        userId: 1,
        username: "alice",
        content: "matching result",
        timestamp: Date.now(),
      },
    ];

    useChatStore.getState().handleWsEvent({
      type: "search_results",
      messages: results,
      query: "matching",
    });

    const state = useChatStore.getState();
    expect(state.searchResults).toHaveLength(1);
    expect(state.searchQuery).toBe("matching");
  });

  it("should handle unread_counts event", () => {
    useChatStore.getState().handleWsEvent({
      type: "unread_counts",
      unreadDms: 5,
    });

    expect(useChatStore.getState().unreadDmCount).toBe(5);
  });

  it("should prepend messages correctly", () => {
    useChatStore.setState({
      messages: [
        {
          id: 10,
          messageType: "text",
          userId: 1,
          username: "alice",
          content: "newer",
          timestamp: Date.now(),
        },
      ],
      oldestMessageId: 10,
    });

    useChatStore.getState().prependMessages(
      [
        {
          id: 5,
          messageType: "text",
          userId: 1,
          username: "alice",
          content: "older",
          timestamp: Date.now() - 1000,
        },
      ],
      false,
    );

    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(2);
    expect(state.messages[0]!.id).toBe(5);
    expect(state.oldestMessageId).toBe(5);
    expect(state.hasMore).toBe(false);
  });

  it("should reset state", () => {
    useChatStore.setState({
      messages: [
        { id: 1, messageType: "system", content: "test", timestamp: 0 },
      ],
      users: [{ id: 1, username: "test", createdAt: 0, lastSeen: 0 }],
      unreadDmCount: 5,
    });

    useChatStore.getState().reset();

    const state = useChatStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.users).toEqual([]);
    expect(state.unreadDmCount).toBe(0);
  });

  // -------------------------------------------------------------------
  // Regression: join/leave presence consistency
  // -------------------------------------------------------------------

  it("users event is authoritative and replaces the full list", () => {
    const userA: User = { id: 1, username: "alice", createdAt: 0, lastSeen: 0 };
    const userB: User = { id: 2, username: "bob", createdAt: 0, lastSeen: 0 };
    const store = useChatStore.getState();

    // Both join
    store.handleWsEvent({ type: "user_joined", user: userA });
    store.handleWsEvent({ type: "user_joined", user: userB });
    expect(useChatStore.getState().users).toHaveLength(2);

    // Server sends an authoritative list with only A (B left)
    store.handleWsEvent({ type: "users", users: [userA] });

    expect(useChatStore.getState().users).toHaveLength(1);
    expect(useChatStore.getState().users[0]!.username).toBe("alice");
  });

  it("user_left removes the correct user and leaves others intact", () => {
    useChatStore.setState({
      users: [
        { id: 1, username: "alice", createdAt: 0, lastSeen: 0 },
        { id: 2, username: "bob", createdAt: 0, lastSeen: 0 },
        { id: 3, username: "carol", createdAt: 0, lastSeen: 0 },
      ],
    });

    useChatStore.getState().handleWsEvent({
      type: "user_left",
      userId: 2,
      username: "bob",
    });

    const users = useChatStore.getState().users;
    expect(users).toHaveLength(2);
    expect(users.map((u) => u.username)).toEqual(["alice", "carol"]);
  });

  it("rapid join-leave-join cycle for same user shows user exactly once", () => {
    const user: User = { id: 5, username: "rapid", createdAt: 0, lastSeen: 0 };
    const other: User = { id: 6, username: "other", createdAt: 0, lastSeen: 0 };
    const store = useChatStore.getState();

    store.handleWsEvent({ type: "user_joined", user: other });

    // Simulate Strict-Mode: user joins, immediately leaves, then joins again
    store.handleWsEvent({ type: "user_joined", user });
    store.handleWsEvent({ type: "user_left", userId: user.id, username: user.username });
    store.handleWsEvent({ type: "user_joined", user });

    const users = useChatStore.getState().users;
    const rapidUsers = users.filter((u) => u.id === user.id);
    expect(rapidUsers).toHaveLength(1); // exactly once, no duplicates
    expect(users.some((u) => u.id === other.id)).toBe(true); // other still present
  });

  it("users event after leave contains remaining members only", () => {
    const userA: User = { id: 1, username: "alice", createdAt: 0, lastSeen: 0 };
    const userB: User = { id: 2, username: "bob", createdAt: 0, lastSeen: 0 };
    const store = useChatStore.getState();

    store.handleWsEvent({ type: "users", users: [userA, userB] });
    expect(useChatStore.getState().users).toHaveLength(2);

    // B leaves; server sends authoritative list with only A
    store.handleWsEvent({ type: "user_left", userId: userB.id, username: userB.username });
    store.handleWsEvent({ type: "users", users: [userA] });

    const state = useChatStore.getState();
    expect(state.users).toHaveLength(1);
    expect(state.users[0]!.id).toBe(userA.id);
  });

  it("wsError is set when error event is received", () => {
    const store = useChatStore.getState();
    store.handleWsEvent({ type: "error", message: "not authorized" });
    expect(useChatStore.getState().wsError).toBe("not authorized");
  });

  it("clearWsError resets wsError to null", () => {
    useChatStore.setState({ wsError: "some error" });
    useChatStore.getState().clearWsError();
    expect(useChatStore.getState().wsError).toBeNull();
  });

  it("setMessages replaces messages and sets hasMore", () => {
    useChatStore.setState({ messages: [{ id: 99, messageType: "system", content: "old", timestamp: 0 }], hasMore: true });
    const newMessages: ChatMessage[] = [
      { id: 1, messageType: "text", userId: 1, username: "alice", content: "a", timestamp: 100 },
      { id: 2, messageType: "text", userId: 1, username: "alice", content: "b", timestamp: 200 },
    ];
    useChatStore.getState().setMessages(newMessages, false);
    const state = useChatStore.getState();
    expect(state.messages).toEqual(newMessages);
    expect(state.hasMore).toBe(false);
    expect(state.oldestMessageId).toBe(1);
  });

  it("addMessage appends to messages list", () => {
    const existing: ChatMessage = { id: 1, messageType: "text", userId: 1, username: "alice", content: "first", timestamp: 100 };
    useChatStore.setState({ messages: [existing] });
    const newMsg: ChatMessage = { id: 2, messageType: "text", userId: 2, username: "bob", content: "second", timestamp: 200 };
    useChatStore.getState().addMessage(newMsg);
    const msgs = useChatStore.getState().messages;
    expect(msgs).toHaveLength(2);
    expect(msgs[1]!.id).toBe(2);
  });

  it("setUsers replaces user list", () => {
    useChatStore.setState({ users: [{ id: 1, username: "old", createdAt: 0, lastSeen: 0 }] });
    const newUsers: User[] = [
      { id: 2, username: "new1", createdAt: 0, lastSeen: 0 },
      { id: 3, username: "new2", createdAt: 0, lastSeen: 0 },
    ];
    useChatStore.getState().setUsers(newUsers);
    expect(useChatStore.getState().users).toEqual(newUsers);
  });

  it("setEditingMessage sets editingMessageId", () => {
    useChatStore.setState({
      messages: [{ id: 7, messageType: "text", userId: 1, username: "alice", content: "edit me", timestamp: 0 }],
    });
    useChatStore.getState().setEditingMessage(7);
    expect(useChatStore.getState().editingMessageId).toBe(7);
    expect(useChatStore.getState().replyingTo).toBeNull();
  });

  it("setReplyingTo sets replyingTo message", () => {
    const msg: ChatMessage = { id: 3, messageType: "text", userId: 1, username: "alice", content: "reply to me", timestamp: 0 };
    useChatStore.getState().setReplyingTo(msg);
    expect(useChatStore.getState().replyingTo).toEqual(msg);
    expect(useChatStore.getState().editingMessageId).toBeNull();
  });

  it("openPrivateChat sets privateChatUserId and username", () => {
    useChatStore.getState().openPrivateChat(5, "charlie");
    const state = useChatStore.getState();
    expect(state.privateChatUserId).toBe(5);
    expect(state.privateChatUsername).toBe("charlie");
    expect(state.privateMessages).toEqual([]);
  });

  it("closePrivateChat clears private chat state", () => {
    useChatStore.setState({ privateChatUserId: 5, privateChatUsername: "charlie" });
    useChatStore.getState().closePrivateChat();
    const state = useChatStore.getState();
    expect(state.privateChatUserId).toBeNull();
    expect(state.privateChatUsername).toBe("");
  });

  it("clearSearch clears searchResults and searchQuery", () => {
    useChatStore.setState({
      searchResults: [{ id: 1, messageType: "system", content: "x", timestamp: 0 }],
      searchQuery: "x",
    });
    useChatStore.getState().clearSearch();
    expect(useChatStore.getState().searchResults).toEqual([]);
    expect(useChatStore.getState().searchQuery).toBe("");
  });

  it("typing_start adds user to typingUsers", () => {
    useChatStore.getState().handleWsEvent({ type: "typing", userId: 10, username: "diana", isTyping: true });
    const typing = useChatStore.getState().typingUsers;
    expect(typing).toHaveLength(1);
    expect(typing[0]).toEqual({ userId: 10, username: "diana" });
  });

  it("typing_stop removes user from typingUsers", () => {
    useChatStore.setState({ typingUsers: [{ userId: 10, username: "diana" }] });
    useChatStore.getState().handleWsEvent({ type: "typing", userId: 10, username: "diana", isTyping: false });
    expect(useChatStore.getState().typingUsers).toHaveLength(0);
  });

  it("typing_start does not duplicate same user", () => {
    useChatStore.getState().handleWsEvent({ type: "typing", userId: 10, username: "diana", isTyping: true });
    useChatStore.getState().handleWsEvent({ type: "typing", userId: 10, username: "diana", isTyping: true });
    expect(useChatStore.getState().typingUsers).toHaveLength(1);
  });

  it("unread_counts event updates unreadDmCount", () => {
    useChatStore.setState({ unreadDmCount: 0 });
    useChatStore.getState().handleWsEvent({ type: "unread_counts", unreadDms: 12 });
    expect(useChatStore.getState().unreadDmCount).toBe(12);
  });
});

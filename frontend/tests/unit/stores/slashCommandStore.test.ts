import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import type { ChatMessage, PrivateMessage } from "@/api/types";

// ---------- chatStore clear actions ----------

describe("chatStore.clearMessages", () => {
  beforeEach(() => {
    useChatStore.getState().reset();
  });

  it("clears messages, hasMore, and oldestMessageId", () => {
    const msg: ChatMessage = {
      id: 1,
      messageType: "text",
      userId: 1,
      username: "alice",
      content: "hello",
      timestamp: Date.now(),
    };
    useChatStore.getState().handleWsEvent({
      type: "history",
      messages: [msg],
      hasMore: true,
    });
    expect(useChatStore.getState().messages).toHaveLength(1);
    expect(useChatStore.getState().hasMore).toBe(true);
    expect(useChatStore.getState().oldestMessageId).toBe(1);

    useChatStore.getState().clearMessages();

    expect(useChatStore.getState().messages).toHaveLength(0);
    expect(useChatStore.getState().hasMore).toBe(false);
    expect(useChatStore.getState().oldestMessageId).toBeNull();
  });

  it("does not affect private messages", () => {
    useChatStore.setState({
      privateMessages: [{ id: 5, content: "dm" }] as PrivateMessage[],
    });
    useChatStore.getState().clearMessages();
    expect(useChatStore.getState().privateMessages).toHaveLength(1);
  });
});

describe("chatStore.clearPrivateMessages", () => {
  beforeEach(() => {
    useChatStore.getState().reset();
  });

  it("clears privateMessages and privateHasMore", () => {
    useChatStore.setState({
      privateMessages: [{ id: 10, content: "hi" }] as PrivateMessage[],
      privateHasMore: true,
    });
    useChatStore.getState().clearPrivateMessages();

    expect(useChatStore.getState().privateMessages).toHaveLength(0);
    expect(useChatStore.getState().privateHasMore).toBe(false);
  });

  it("does not affect room messages", () => {
    const msg: ChatMessage = {
      id: 1,
      messageType: "text",
      userId: 1,
      username: "alice",
      content: "hello",
      timestamp: Date.now(),
    };
    useChatStore.getState().handleWsEvent({
      type: "history",
      messages: [msg],
      hasMore: false,
    });
    useChatStore.getState().clearPrivateMessages();
    expect(useChatStore.getState().messages).toHaveLength(1);
  });
});

// ---------- uiStore effect actions ----------

describe("uiStore.triggerEffect / clearEffect", () => {
  beforeEach(() => {
    useUiStore.setState({ activeEffect: null });
  });

  it("sets activeEffect with name and triggeredBy", () => {
    useUiStore.getState().triggerEffect("snow", "alice");
    expect(useUiStore.getState().activeEffect).toEqual({ name: "snow", triggeredBy: "alice" });
  });

  it("overwrites an existing effect (replaying while one is active)", () => {
    useUiStore.getState().triggerEffect("snow", "alice");
    useUiStore.getState().triggerEffect("fireworks", "bob");
    expect(useUiStore.getState().activeEffect).toEqual({ name: "fireworks", triggeredBy: "bob" });
  });

  it("clearEffect sets activeEffect to null", () => {
    useUiStore.getState().triggerEffect("rain", "charlie");
    useUiStore.getState().clearEffect();
    expect(useUiStore.getState().activeEffect).toBeNull();
  });

  it("all four effect names are accepted", () => {
    for (const name of ["snow", "confetti", "fireworks", "rain"]) {
      useUiStore.getState().triggerEffect(name, "user");
      expect(useUiStore.getState().activeEffect?.name).toBe(name);
    }
  });
});

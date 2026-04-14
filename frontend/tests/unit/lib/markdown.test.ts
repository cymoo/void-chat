import { describe, it, expect } from "vitest";
import { renderMarkdown, highlightMentions, escapeHtml } from "@/lib/markdown";

describe("renderMarkdown", () => {
  it("converts markdown to HTML", () => {
    const result = renderMarkdown("**bold** and *italic*");
    expect(result).toContain("<strong>bold</strong>");
    expect(result).toContain("<em>italic</em>");
  });

  it("converts inline code", () => {
    const result = renderMarkdown("`code`");
    expect(result).toContain("<code>code</code>");
  });

  it("converts links", () => {
    const result = renderMarkdown("[link](https://example.com)");
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain("link</a>");
  });

  it("supports line breaks (breaks: true)", () => {
    const result = renderMarkdown("line1\nline2");
    expect(result).toContain("<br");
  });

  it("sanitizes script tags (XSS prevention)", () => {
    const result = renderMarkdown('<script>alert("xss")</script>');
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
  });

  it("sanitizes onerror attributes (XSS prevention)", () => {
    const result = renderMarkdown('<img src=x onerror="alert(1)">');
    expect(result).not.toContain("onerror");
  });
});

describe("highlightMentions", () => {
  it("wraps @mentions in highlight spans", () => {
    const result = highlightMentions("Hello @alice and @bob");
    expect(result).toContain('class="mention-highlight"');
    expect(result).toContain('data-mention-user="alice"');
    expect(result).toContain('data-mention-user="bob"');
    expect(result).toContain("@alice</span>");
    expect(result).toContain("@bob</span>");
  });

  it("adds mention-self class for current user", () => {
    const result = highlightMentions("Hey @alice", "alice");
    expect(result).toContain("mention-self");
    expect(result).toContain('data-mention-user="alice"');
  });

  it("is case-insensitive for self-mention matching", () => {
    const result = highlightMentions("Hey @Alice", "alice");
    expect(result).toContain("mention-self");
  });

  it("does not add mention-self for other users", () => {
    const result = highlightMentions("Hey @bob", "alice");
    expect(result).not.toContain("mention-self");
  });

  it("returns text unchanged when no mentions present", () => {
    const result = highlightMentions("Hello world");
    expect(result).toBe("Hello world");
  });
});

describe("escapeHtml", () => {
  it("escapes HTML special characters", () => {
    const result = escapeHtml('<script>alert("xss")</script>');
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("returns plain text unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});

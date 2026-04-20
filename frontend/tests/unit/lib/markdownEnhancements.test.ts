import { describe, it, expect } from "vitest";
import { renderMarkdown } from "@/lib/markdown";

describe("renderMarkdown enhancements", () => {
  it("adds target=_blank to links", () => {
    const result = renderMarkdown("[test](https://example.com)");
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it("adds target=_blank to auto-linked URLs", () => {
    const result = renderMarkdown("Visit https://example.com for more");
    expect(result).toContain('target="_blank"');
  });

  it("wraps code blocks with copy button container", () => {
    const result = renderMarkdown("```js\nconsole.log('hi');\n```");
    expect(result).toContain("code-block-wrap");
    expect(result).toContain("code-copy-btn");
    expect(result).toContain("⧉");
  });

  it("does not add copy button to inline code", () => {
    const result = renderMarkdown("use `const x = 1` here");
    expect(result).not.toContain("code-block-wrap");
    expect(result).not.toContain("code-copy-btn");
  });
});

import { marked } from "marked";
import DOMPurify from "dompurify";

// Open external links in new tab
const renderer = new marked.Renderer();
const defaultLinkRenderer = renderer.link.bind(renderer);
renderer.link = function (token) {
  const html = defaultLinkRenderer(token);
  if (token.href && !token.href.startsWith("#")) {
    return html.replace(/^<a /, '<a target="_blank" rel="noopener noreferrer" ');
  }
  return html;
};

// Wrap code blocks with a copy button
renderer.code = function ({ text, lang }) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const langLabel = lang ? ` data-lang="${lang}"` : "";
  return `<div class="code-block-wrapper"${langLabel}><button type="button" class="code-copy-btn" title="Copy">⧉</button><pre><code>${escaped}</code></pre></div>`;
};

marked.setOptions({
  breaks: true,
  gfm: true,
  renderer,
});

// Allow target and rel on sanitized links, and the copy button
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.getAttribute("target") === "_blank") {
    node.setAttribute("rel", "noopener noreferrer");
  }
});

export function renderMarkdown(text: string): string {
  const raw = marked.parse(text) as string;
  return DOMPurify.sanitize(raw, {
    ADD_ATTR: ["target", "rel", "data-lang"],
    ADD_TAGS: ["button"],
  });
}

export function highlightMentions(
  html: string,
  currentUsername?: string,
  currentDisplayName?: string,
): string {
  return html.replace(
    /@([\p{L}\p{N}_]+)/gu,
    (_match, name: string) => {
      const lower = name.toLowerCase();
      const isSelf =
        (currentUsername && lower === currentUsername.toLowerCase()) ||
        (currentDisplayName && lower === currentDisplayName.toLowerCase());
      return `<span class="mention-highlight${isSelf ? " mention-self" : ""}" data-mention-user="${name}">@${name}</span>`;
    },
  );
}

export function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/** Attach code-copy click handlers to copy buttons inside a container element */
export function attachCodeCopyHandlers(container: HTMLElement) {
  container.querySelectorAll<HTMLButtonElement>(".code-copy-btn").forEach((btn) => {
    btn.onclick = () => {
      const code = btn.nextElementSibling?.textContent ?? "";
      navigator.clipboard.writeText(code).then(
        () => {
          btn.textContent = "✓";
          setTimeout(() => { btn.textContent = "⧉"; }, 1500);
        },
        () => {
          btn.textContent = "✗";
          setTimeout(() => { btn.textContent = "⧉"; }, 1500);
        },
      );
    };
  });
}

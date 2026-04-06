import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({
  breaks: true,
  gfm: true,
});

export function renderMarkdown(text: string): string {
  const raw = marked.parse(text) as string;
  return DOMPurify.sanitize(raw);
}

export function highlightMentions(
  html: string,
  currentUsername?: string,
): string {
  return html.replace(
    /@(\w+)/g,
    (_match, username: string) => {
      const isSelf =
        currentUsername &&
        username.toLowerCase() === currentUsername.toLowerCase();
      return `<span class="mention-highlight${isSelf ? " mention-self" : ""}" data-mention-user="${username}">@${username}</span>`;
    },
  );
}

export function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

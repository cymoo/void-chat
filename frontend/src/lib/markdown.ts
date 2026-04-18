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

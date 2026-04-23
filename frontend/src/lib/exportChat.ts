import DOMPurify from "dompurify";
import type { ChatMessage, PrivateMessage } from "@/api/types";

const safe = (str: string) =>
  DOMPurify.sanitize(str, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });

const safeUrl = (url: string) => {
  try {
    const u = new URL(url, window.location.href);
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch {
    // ignore invalid urls
  }
  return "#";
};

const formatDate = (ts: number) =>
  new Date(ts).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function renderRoomMessage(msg: ChatMessage): string {
  const time = formatDate(msg.timestamp);

  if (msg.messageType === "system") {
    return `<div class="msg system">
  <span class="meta-time">${safe(time)}</span>
  <span class="content sys">${safe(msg.content)}</span>
</div>`;
  }

  const author = safe(msg.username);
  let body = "";

  if (msg.messageType === "text") {
    body = `<span class="content">${safe(msg.content)}</span>`;
  } else if (msg.messageType === "image") {
    const url = safeUrl(msg.imageUrl);
    body = `<a href="${url}" target="_blank" rel="noopener noreferrer">[image: ${url}]</a>`;
  } else if (msg.messageType === "file") {
    const url = safeUrl(msg.fileUrl);
    body = `<a href="${url}" target="_blank" rel="noopener noreferrer">${safe(msg.fileName)}</a>`;
  }

  return `<div class="msg">
  <span class="meta-author">${author}</span>
  <span class="meta-time">${safe(time)}</span>
  <span class="content">${body}</span>
</div>`;
}

function renderPrivateMessage(msg: PrivateMessage): string {
  const time = formatDate(msg.timestamp);
  const author = safe(msg.senderUsername);
  let body = "";

  if (msg.messageType === "text") {
    body = `<span class="content">${safe(msg.content ?? "")}</span>`;
  } else if (msg.messageType === "image") {
    const url = safeUrl(msg.fileUrl ?? "");
    body = `<a href="${url}" target="_blank" rel="noopener noreferrer">[image: ${url}]</a>`;
  } else if (msg.messageType === "file") {
    const url = safeUrl(msg.fileUrl ?? "");
    body = `<a href="${url}" target="_blank" rel="noopener noreferrer">${safe(msg.fileName ?? "file")}</a>`;
  }

  return `<div class="msg">
  <span class="meta-author">${author}</span>
  <span class="meta-time">${safe(time)}</span>
  <span class="content">${body}</span>
</div>`;
}

function buildHtml(title: string, bodyRows: string[], total: number): string {
  const capped = total >= 10000;
  const footer = capped
    ? `<p class="footer">Showing first 10,000 messages (export cap). Older messages may be omitted.</p>`
    : `<p class="footer">${total} message${total !== 1 ? "s" : ""} exported.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${safe(title)}</title>
<style>
  body { background: #0a0e14; color: #c5cdd9; font-family: "IBM Plex Mono", monospace; font-size: 13px; margin: 0; padding: 20px; }
  h1 { color: #00ff41; font-family: "Bebas Neue", sans-serif; letter-spacing: 2px; font-size: 28px; margin-bottom: 4px; }
  .subtitle { color: #4a6480; font-size: 11px; margin-bottom: 24px; }
  .msg { display: grid; grid-template-columns: 140px 180px 1fr; gap: 8px; padding: 6px 0; border-bottom: 1px solid #0d1117; }
  .msg.system { grid-template-columns: 140px 1fr; }
  .meta-author { color: #00d9ff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta-time { color: #4a6480; font-size: 11px; align-self: center; }
  .content { word-break: break-word; }
  .sys { color: #4a6480; font-style: italic; }
  a { color: #00d9ff; }
  .footer { margin-top: 24px; color: #4a6480; font-size: 11px; border-top: 1px solid #0d1117; padding-top: 12px; }
</style>
</head>
<body>
<h1>${safe(title)}</h1>
<p class="subtitle">Exported ${new Date().toLocaleString()}</p>
${bodyRows.join("\n")}
${footer}
</body>
</html>`;
}

function triggerDownload(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportRoomChat(roomName: string, messages: ChatMessage[]) {
  const rows = messages.map(renderRoomMessage);
  const html = buildHtml(`#${roomName}`, rows, messages.length);
  const slug = roomName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  triggerDownload(html, `chat-${slug}-${Date.now()}.html`);
}

export function exportDmChat(
  partnerUsername: string,
  messages: PrivateMessage[],
) {
  const rows = messages.map(renderPrivateMessage);
  const html = buildHtml(`DM: ${partnerUsername}`, rows, messages.length);
  const slug = partnerUsername.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  triggerDownload(html, `dm-${slug}-${Date.now()}.html`);
}

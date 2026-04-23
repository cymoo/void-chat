import type { ChatMessage, PrivateMessage } from "@/api/types";

// Escape text for safe insertion into HTML content/attributes.
// Using entity escaping rather than DOMPurify because this is static
// HTML generation — we want to PRESERVE all content, not strip tags.
const safe = (str: string) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const safeUrl = (url: string) => {
  try {
    const u = new URL(url, window.location.href);
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch {
    // ignore invalid urls
  }
  return null;
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
    return `<div class="msg system"><span class="time">${safe(time)}</span><span class="body">${safe(msg.content)}</span></div>`;
  }

  const author = safe(msg.username);
  let body = "";

  if (msg.messageType === "text") {
    body = safe(msg.content);
  } else if (msg.messageType === "image") {
    const url = safeUrl(msg.imageUrl);
    body = url
      ? `<a href="${url}" target="_blank" rel="noopener noreferrer">[image: ${url}]</a>`
      : `[image]`;
  } else if (msg.messageType === "file") {
    const url = safeUrl(msg.fileUrl);
    body = url
      ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${safe(msg.fileName)}</a>`
      : safe(msg.fileName);
  }

  return `<div class="msg"><div class="meta"><b>${author}</b><br><span class="time">${safe(time)}</span></div><div class="body">${body}</div></div>`;
}

function renderPrivateMessage(msg: PrivateMessage): string {
  const time = formatDate(msg.timestamp);
  const author = safe(msg.senderUsername);
  let body = "";

  if (msg.messageType === "text") {
    body = safe(msg.content ?? "");
  } else if (msg.messageType === "image") {
    const url = safeUrl(msg.fileUrl ?? "");
    body = url
      ? `<a href="${url}" target="_blank" rel="noopener noreferrer">[image: ${url}]</a>`
      : "[image]";
  } else if (msg.messageType === "file") {
    const url = safeUrl(msg.fileUrl ?? "");
    const name = safe(msg.fileName ?? "file");
    body = url
      ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${name}</a>`
      : name;
  }

  return `<div class="msg"><div class="meta"><b>${author}</b><br><span class="time">${safe(time)}</span></div><div class="body">${body}</div></div>`;
}

function buildHtml(title: string, bodyRows: string[], total: number): string {
  const capped = total >= 10000;
  const footer = capped
    ? `<p class="footer">Showing first 10,000 messages (export cap).</p>`
    : `<p class="footer">${total} message${total !== 1 ? "s" : ""} exported.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${safe(title)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 24px; color: #333; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .subtitle { color: #666; font-size: 13px; margin-bottom: 20px; }
  .msg { display: flex; gap: 16px; padding: 6px 0; border-bottom: 1px solid #eee; word-break: break-word; }
  .msg.system { color: #888; font-style: italic; gap: 8px; align-items: baseline; }
  .meta { flex: 0 0 150px; font-size: 13px; overflow: hidden; }
  .time { color: #999; font-size: 11px; }
  .body { flex: 1; }
  a { color: #0066cc; }
  .footer { margin-top: 20px; color: #888; font-size: 12px; border-top: 1px solid #eee; padding-top: 12px; }
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

import { useState, useRef, type KeyboardEvent } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import { formatTime, escapeHtml } from "@/lib/utils";
import type { WsSendPayload } from "@/api/types";

interface SearchPanelProps {
  send: (payload: WsSendPayload) => void;
}

export function SearchPanel({ send }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const searchResults = useChatStore((s) => s.searchResults);
  const searchQuery = useChatStore((s) => s.searchQuery);
  const clearSearch = useChatStore((s) => s.clearSearch);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);

  const handleSearch = () => {
    const q = query.trim();
    if (q) {
      send({ type: "search", query: q });
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
    if (e.key === "Escape") {
      handleClose();
    }
  };

  const handleClose = () => {
    clearSearch();
    setSearchOpen(false);
  };

  const handleResultClick = (messageId: number) => {
    const el = document.querySelector(`[data-message-id="${messageId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("message-highlight");
      setTimeout(() => el.classList.remove("message-highlight"), 2000);
    }
  };

  const highlightQuery = (text: string, q: string): string => {
    if (!q) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
  };

  return (
    <div className="search-bar" style={{ display: "block" }}>
      <div className="search-input-wrapper">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          className="search-input"
          type="text"
          placeholder="Search messages..."
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <button className="search-close-btn" onClick={handleClose}>
          ×
        </button>
      </div>
      {searchResults.length > 0 && (
        <div className="search-results" style={{ display: "block" }}>
          {searchResults.map((msg) => (
            <div
              key={msg.id}
              className="search-result-item"
              onClick={() => handleResultClick(msg.id)}
            >
              <div className="search-result-header">
                <span className="search-result-author">
                  {msg.messageType !== "system" ? msg.username : "System"}
                </span>
                <span className="search-result-time">{formatTime(msg.timestamp)}</span>
              </div>
              <div
                className="search-result-content"
                dangerouslySetInnerHTML={{
                  __html: highlightQuery(
                    msg.messageType === "text"
                      ? msg.content
                      : msg.messageType === "image"
                        ? "shared an image"
                        : msg.messageType === "file"
                          ? msg.fileName
                          : msg.messageType === "system"
                            ? msg.content
                            : "",
                    searchQuery,
                  ),
                }}
              />
            </div>
          ))}
        </div>
      )}
      {searchQuery && searchResults.length === 0 && (
        <div className="search-results" style={{ display: "block" }}>
          <div className="search-no-results">No results found</div>
        </div>
      )}
    </div>
  );
}

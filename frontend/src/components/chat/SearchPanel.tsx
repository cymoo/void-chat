import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import { formatTime, escapeHtml } from "@/lib/utils";
import { requestMessageJump } from "@/lib/messageJump";
import type { WsSendPayload } from "@/api/types";

const PAGE_SIZE = 20;
const MAX_PREVIEW_LEN = 120;

interface SearchPanelProps {
  send: (payload: WsSendPayload) => void;
}

export function SearchPanel({ send }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [page, setPage] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchResults = useChatStore((s) => s.searchResults);
  const searchQuery = useChatStore((s) => s.searchQuery);
  const clearSearch = useChatStore((s) => s.clearSearch);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);

  const totalPages = Math.max(1, Math.ceil(searchResults.length / PAGE_SIZE));
  const pagedResults = searchResults.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const doSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (trimmed) {
        send({ type: "search", query: trimmed });
        setPage(0);
        setSelectedIndex(-1);
      }
    },
    [send],
  );

  // Debounced search on input change
  useEffect(() => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length >= 2) {
      debounceRef.current = window.setTimeout(() => doSearch(q), 350);
    }
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doSearch(query);
    }
    if (e.key === "Escape") {
      handleClose();
    }
    if (e.key === "ArrowDown" && pagedResults.length > 0) {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, pagedResults.length - 1));
    }
    if (e.key === "ArrowUp" && pagedResults.length > 0) {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }
    if ((e.key === "Enter" || e.key === " ") && selectedIndex >= 0 && pagedResults[selectedIndex]) {
      e.preventDefault();
      handleResultClick(pagedResults[selectedIndex]!.id);
    }
  };

  const handleClose = () => {
    clearSearch();
    setSearchOpen(false);
  };

  const handleResultClick = (messageId: number) => {
    requestMessageJump(messageId);
    handleClose();
  };

  const truncate = (text: string): string =>
    text.length > MAX_PREVIEW_LEN ? text.slice(0, MAX_PREVIEW_LEN) + "…" : text;

  const highlightQuery = (text: string, q: string): string => {
    if (!q) return escapeHtml(text);
    const escaped = escapeHtml(truncate(text));
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
  };

  // Scroll selected result into view
  useEffect(() => {
    if (selectedIndex < 0) return;
    const container = resultsRef.current;
    const items = container?.querySelectorAll(".search-result-item");
    items?.[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <div className="search-bar" role="search">
      <div className="search-input-wrapper">
        <Search size={16} />
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
          aria-label="Search chat messages"
        />
        {query.trim().length > 0 && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => setQuery("")}
            aria-label="Clear search input"
          >
            CLEAR
          </button>
        )}
        <button type="button" className="search-close-btn" onClick={handleClose} aria-label="Close search panel">
          ×
        </button>
      </div>
      {searchQuery && (
        <div className="search-meta">
          <span>QUERY: {searchQuery}</span>
          <span>
            {searchResults.length} RESULT{searchResults.length === 1 ? "" : "S"}
            {totalPages > 1 && ` — PAGE ${page + 1}/${totalPages}`}
          </span>
        </div>
      )}
      {pagedResults.length > 0 && (
        <div className="search-results" role="listbox" ref={resultsRef}>
          {pagedResults.map((msg, i) => (
            <div
              key={msg.id}
              className={`search-result-item${i === selectedIndex ? " search-result-selected" : ""}`}
              role="option"
              aria-selected={i === selectedIndex}
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
        <div className="search-results">
          <div className="search-no-results">No results found</div>
        </div>
      )}
      {totalPages > 1 && (
        <div className="search-pagination">
          <button
            type="button"
            className="search-page-btn"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            ← PREV
          </button>
          <span className="search-page-info">{page + 1} / {totalPages}</span>
          <button
            type="button"
            className="search-page-btn"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            NEXT →
          </button>
        </div>
      )}
    </div>
  );
}

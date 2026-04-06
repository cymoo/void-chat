import { useState, type FormEvent } from "react";
import type { WsSendPayload } from "@/api/types";
import { useChatStore } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import { MessageItem } from "./MessageItem";

interface SearchPanelProps {
  send: (payload: WsSendPayload) => void;
}

export function SearchPanel({ send }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const searchResults = useChatStore((s) => s.searchResults);
  const searchQuery = useChatStore((s) => s.searchQuery);
  const clearSearch = useChatStore((s) => s.clearSearch);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      send({ type: "search", query: query.trim() });
    }
  };

  const handleClose = () => {
    clearSearch();
    setSearchOpen(false);
  };

  return (
    <div className="border-b border-terminal-border bg-terminal-surface-2 max-h-64 flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <span className="text-terminal-amber shrink-0">SEARCH $</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-terminal-text font-mono text-sm focus:outline-none"
            placeholder="search messages..."
            autoFocus
          />
        </form>
        <button
          onClick={handleClose}
          className="text-terminal-text-dim hover:text-terminal-red text-sm px-1"
        >
          ×
        </button>
      </div>

      {searchQuery && (
        <div className="overflow-y-auto px-4 pb-2 flex-1">
          {searchResults.length === 0 ? (
            <div className="text-terminal-text-dim text-xs py-2">
              No results for "{searchQuery}"
            </div>
          ) : (
            <div className="text-terminal-text-dim text-xs mb-1">
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for "
              {searchQuery}"
            </div>
          )}
          {searchResults.map((msg) => (
            <MessageItem key={msg.id} message={msg} isOwn={false} send={send} />
          ))}
        </div>
      )}
    </div>
  );
}

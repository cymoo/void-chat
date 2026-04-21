import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type RefObject,
  type KeyboardEvent,
  type ChangeEvent,
  type ClipboardEvent,
} from "react";
import { useUiStore } from "@/stores/uiStore";
import * as api from "@/api/client";

interface UseMessageComposerOptions {
  /** Called when the user presses Enter (without Shift) or clicks Send. */
  onSubmit: (text: string) => void;
  /** Called after an image is successfully uploaded. */
  onImageUploaded: (url: string, thumbnailUrl?: string, width?: number, height?: number) => void;
  /** Called after a non-image file is successfully uploaded. */
  onFileUploaded: (fileName: string, fileUrl: string, fileSize: number, mimeType: string) => void;
  /**
   * Optional hook called on every text change (after setText).
   * Use for mention detection, typing indicators, etc.
   */
  onTextChange?: (text: string, textarea: HTMLTextAreaElement | null) => void;
}

export interface MessageComposerReturn {
  text: string;
  setText: (text: string) => void;
  canSend: boolean;
  uploading: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  emojiOpen: boolean;
  setEmojiOpen: (open: boolean) => void;
  /** True when the emoji picker was opened by typing ':' (caret stays in textarea). */
  emojiColonMode: boolean;
  handleChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  /** Base keyboard handler (Enter to send, Shift+Enter for newline). Wrap this to add custom key handling. */
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleSend: () => void;
  handlePaste: (e: ClipboardEvent<HTMLTextAreaElement>) => void;
  handleAttach: (e: ChangeEvent<HTMLInputElement>) => void;
  handleSelectEmoji: (emoji: string) => void;
  insertAtCursor: (content: string) => void;
}

export function useMessageComposer({
  onSubmit,
  onImageUploaded,
  onFileUploaded,
  onTextChange,
}: UseMessageComposerOptions): MessageComposerReturn {
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpenRaw] = useState(false);
  const [emojiColonMode, setEmojiColonMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const addToast = useUiStore((s) => s.addToast);
  // Cursor position (after ':') when colon-triggered emoji picker opens
  const emojiColonCursorPos = useRef<number | null>(null);

  // Closing the picker always resets colon-mode state
  const setEmojiOpen = useCallback((open: boolean) => {
    setEmojiOpenRaw(open);
    if (!open) {
      setEmojiColonMode(false);
      emojiColonCursorPos.current = null;
    }
  }, []);

  const canSend = text.trim().length > 0;

  // Stable refs for callbacks
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const onImageUploadedRef = useRef(onImageUploaded);
  onImageUploadedRef.current = onImageUploaded;
  const onFileUploadedRef = useRef(onFileUploaded);
  onFileUploadedRef.current = onFileUploaded;
  const onTextChangeRef = useRef(onTextChange);
  onTextChangeRef.current = onTextChange;

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, []);

  useEffect(() => {
    autoResize();
  }, [text, autoResize]);

  const insertAtCursor = useCallback(
    (content: string) => {
      const el = textareaRef.current;
      if (!el) {
        setText((prev) => prev + content);
        return;
      }
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const nextValue = `${text.slice(0, start)}${content}${text.slice(end)}`;
      setText(nextValue);
      requestAnimationFrame(() => {
        const caret = start + content.length;
        el.focus();
        el.setSelectionRange(caret, caret);
      });
    },
    [text],
  );

  const handleSelectEmoji = useCallback(
    (emoji: string) => {
      const colonPos = emojiColonCursorPos.current;
      if (colonPos !== null) {
        // Replace the ':' at (colonPos-1) with the selected emoji
        setText((prev) => prev.slice(0, colonPos - 1) + emoji + prev.slice(colonPos));
        requestAnimationFrame(() => {
          const el = textareaRef.current;
          if (el) {
            const newPos = colonPos - 1 + emoji.length;
            el.focus();
            el.setSelectionRange(newPos, newPos);
          }
        });
      } else {
        insertAtCursor(emoji);
      }
      setEmojiOpen(false);
    },
    [insertAtCursor, setEmojiOpen],
  );

  const uploadImage = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const result = await api.uploadImage(file);
      if (result.url) {
        onImageUploadedRef.current(
          result.url,
          result.thumbnail ?? undefined,
          result.width ?? undefined,
          result.height ?? undefined,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Image upload failed";
      addToast(msg, "error");
    } finally {
      setUploading(false);
    }
  }, [addToast]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setText(val);
      onTextChangeRef.current?.(val, textareaRef.current);
      // Open emoji picker when user types a standalone ':'
      if (val.endsWith(":")) {
        emojiColonCursorPos.current = e.target.selectionStart;
        setEmojiColonMode(true);
        setEmojiOpenRaw(true);
      }
    },
    [],
  );

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmitRef.current(trimmed);
    setText("");
  }, [text]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const imageItem = Array.from(e.clipboardData.items).find((item) =>
        item.type.startsWith("image/"),
      );
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      e.preventDefault();
      void uploadImage(file);
    },
    [uploadImage],
  );

  const handleAttach = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.type.startsWith("image/")) {
        await uploadImage(file);
      } else {
        setUploading(true);
        try {
          const result = await api.uploadFile(file);
          if (result.url) {
            onFileUploadedRef.current(
              result.fileName ?? file.name,
              result.url,
              result.fileSize ?? file.size,
              file.type,
            );
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "File upload failed";
          addToast(msg, "error");
        } finally {
          setUploading(false);
        }
      }
      e.target.value = "";
    },
    [addToast, uploadImage],
  );

  return {
    text,
    setText,
    canSend,
    uploading,
    textareaRef,
    emojiOpen,
    setEmojiOpen,
    emojiColonMode,
    handleChange,
    handleKeyDown,
    handleSend,
    handlePaste,
    handleAttach,
    handleSelectEmoji,
    insertAtCursor,
  };
}

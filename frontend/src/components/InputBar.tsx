import { useState, useRef, useEffect } from "react";

interface InputBarProps {
  onSend: (text: string) => void;
  onStop: () => void;
  disabled: boolean;
  streaming: boolean;
  waiting: boolean;
}

export default function InputBar({ onSend, onStop, disabled, streaming, waiting }: InputBarProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled && !streaming && !waiting) textareaRef.current?.focus();
  }, [disabled, streaming, waiting]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || streaming || waiting) return;
    onSend(trimmed);
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }
  }, [text]);

  const isStreaming = streaming || waiting;

  return (
    <div className="px-4 pb-4 pt-2 bg-gradient-to-t from-chat-bg via-chat-bg to-transparent">
      <div className="flex items-end gap-2 bg-chat-surface/80 backdrop-blur-sm border border-chat-border/50 rounded-2xl px-4 py-3 shadow-lg shadow-black/20 transition-all duration-200 focus-within:border-chat-accent/50 focus-within:shadow-indigo-500/10">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? "Waiting for response..." : "Type a message..."}
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none bg-transparent text-sm text-chat-text placeholder-chat-text-muted/60 outline-none disabled:opacity-40 leading-relaxed max-h-[200px]"
        />
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={isStreaming ? onStop : handleSend}
            disabled={!isStreaming && (disabled || !text.trim())}
            className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 ${
              isStreaming
                ? "bg-red-500/20 hover:bg-red-500/30 text-red-400"
                : "bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 text-white shadow-lg shadow-indigo-500/20"
            }`}
          >
            {isStreaming ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1.5" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
import { useState } from "react";
import MarkdownText from "./MarkdownText";

interface ThinkingBlockProps {
  text: string;
  status: "loading" | "ready";
}

export default function ThinkingBlock({ text, status }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 leading-none group transition-all duration-150"
      >
        {/* Thinking icon */}
        <svg
          className={`w-4 h-4 shrink-0 transition-colors duration-200 ${
            status === "loading"
              ? "text-indigo-400 animate-pulse"
              : "text-chat-text-muted/50"
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>

        {/* Label */}
        <span className="text-xs text-chat-text-muted/70 group-hover:text-chat-text-muted transition-colors duration-150">
          Thinking
        </span>

        {/* Loading spinner */}
        {status === "loading" && (
          <div className="w-3 h-3 shrink-0 ml-1">
            <svg className="w-3 h-3 text-indigo-400/60 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} opacity={0.2} />
              <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
            </svg>
          </div>
        )}
      </button>

      {expanded && (
        <div className="ml-6 mt-0.5 mb-1 p-3 rounded-lg bg-chat-surface/50 text-xs text-chat-text-muted leading-relaxed border border-chat-border/30 animate-fade-in">
          <MarkdownText text={text} />
        </div>
      )}
    </div>
  );
}

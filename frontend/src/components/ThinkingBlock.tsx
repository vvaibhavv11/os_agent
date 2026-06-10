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
    <div className="px-5 py-1.5 animate-fade-in">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-chat-text-muted hover:text-chat-text transition-all duration-200 group"
      >
        <div className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <span className="group-hover:text-chat-accent transition-colors">Thought</span>
        {!expanded && text.length > 80 ? (
          <span className="text-[10px] opacity-60 ml-1">
            {text.slice(0, 80)}...
          </span>
        ) : !expanded ? (
          <span className="text-[10px] opacity-60 ml-1">
            {text}
          </span>
        ) : null}
      </button>
      {expanded && (
        <div className="mt-1.5 p-3 rounded-xl bg-chat-surface text-xs text-chat-text-muted leading-relaxed border border-chat-border/50 animate-fade-in">
          <MarkdownText text={text} />
        </div>
      )}
    </div>
  );
}

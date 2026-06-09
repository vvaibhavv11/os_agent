import { useState } from "react";
import MarkdownText from "./MarkdownText";
import type { Message } from "../stores/chatStore";

interface BubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: BubbleProps) {
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const isUser = message.speaker === "user";
  const isSystem = message.speaker === "system";
  const hasReasoning = !!message.reasoningText;

  if (isSystem) {
    return (
      <div className="flex justify-center px-5 py-2 animate-fade-in">
        <div className="bg-red-900/30 text-red-300 text-xs px-3.5 py-2 rounded-xl border border-red-800/30">
          {message.messageText}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-3 px-5 py-2 animate-slide-up ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* avatar */}
      <div
        className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center shadow-sm ${
          isUser
            ? "bg-gradient-to-br from-indigo-500 to-purple-600"
            : "bg-gradient-to-br from-slate-600 to-slate-700"
        }`}
      >
        {isUser ? (
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        )}
      </div>

      {/* content */}
      <div className={`flex flex-col flex-1 min-w-0 ${isUser ? "items-end" : "items-start"}`}>
        {hasReasoning && (
          <div className="mb-1.5 max-w-full">
            <button
              onClick={() => setThinkingOpen(!thinkingOpen)}
              className="flex items-center gap-1.5 text-xs text-chat-text-muted hover:text-chat-text transition-all duration-200 group"
            >
              <div className={`transition-transform duration-200 ${thinkingOpen ? "rotate-90" : ""}`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <span className="group-hover:text-chat-accent transition-colors">Thought</span>
              {!thinkingOpen && (
                <span className="text-[10px] opacity-60">
                  ({message.reasoningText!.length > 50
                    ? message.reasoningText!.slice(0, 50) + "..."
                    : "click to expand"})
                </span>
              )}
            </button>
            {thinkingOpen && (
              <div className="mt-1 p-3 rounded-xl bg-slate-800/60 text-xs text-chat-text-muted leading-relaxed border border-chat-border/50 animate-fade-in">
                <MarkdownText text={message.reasoningText || ""} />
              </div>
            )}
          </div>
        )}
        <div
          className={`max-w-[85%] text-sm leading-relaxed min-h-[1.25em] ${
            isUser
              ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl rounded-tr-md px-4 py-2.5 shadow-lg shadow-indigo-500/20"
              : "bg-chat-ai-bubble/80 backdrop-blur-sm border border-chat-border/50 text-chat-text rounded-2xl rounded-tl-md px-4 py-2.5"
          }`}
        >
          <MarkdownText text={message.messageText || ""} />
        </div>
      </div>
    </div>
  );
}
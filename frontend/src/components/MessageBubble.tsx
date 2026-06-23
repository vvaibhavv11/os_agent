import { useState, useCallback } from "react";
import MarkdownText from "./MarkdownText";
import type { UserMessageItem, AssistantMessageItem } from "../stores/chatStore";

interface BubbleProps {
  message: UserMessageItem | AssistantMessageItem;
  showCopy?: boolean;
}

export default function MessageBubble({ message, showCopy }: BubbleProps) {
  const isUser = message.kind === "user_message";
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!message.text) return;
    navigator.clipboard.writeText(message.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [message.text]);

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} px-5 py-1.5 animate-slide-up`}
    >
      <div
        className={`${
          isUser
            ? "max-w-[75%] min-w-[60px]"
            : "w-full max-w-2xl"
        }`}
      >
        {/* Message content */}
        <div
          className={`text-sm leading-relaxed ${
            isUser
              ? "bg-chat-user-bubble/20 border border-chat-user-bubble/30 text-chat-text rounded-2xl rounded-br-md px-4 py-2.5"
              : "text-chat-text"
          }`}
        >
          <MarkdownText text={message.text || ""} />
        </div>

        {/* Copy button — only shown when showCopy is true */}
        {showCopy && (
          <div
            className={`flex items-center mt-1 ${
              isUser ? "justify-end" : "justify-start"
            }`}
          >
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[10px] text-chat-text-muted/50 hover:text-chat-text-muted transition-colors duration-150"
              title="Copy message"
            >
              {copied ? (
                <svg
                  className="w-3.5 h-3.5 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
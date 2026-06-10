import MarkdownText from "./MarkdownText";
import type { UserMessageItem, AssistantMessageItem } from "../stores/chatStore";

interface BubbleProps {
  message: UserMessageItem | AssistantMessageItem;
}

export default function MessageBubble({ message }: BubbleProps) {
  const isUser = message.kind === "user_message";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} px-5 py-3 animate-slide-up`}>
      <div className={`w-full max-w-2xl ${isUser ? "text-right" : "text-left"}`}>
        <div className="text-[11px] font-semibold tracking-wider uppercase mb-1 select-none">
          {isUser ? (
            <span className="text-[#83a598]">USER</span>
          ) : (
            <span className="text-[#fe8019]">AI_CORE // SYNTHESIS</span>
          )}
        </div>
        <div className="text-sm leading-relaxed text-chat-text">
          {isUser ? (
            <span className="text-chat-text-muted select-none">&gt; </span>
          ) : null}
          <MarkdownText text={message.text || ""} />
        </div>
      </div>
    </div>
  );
}
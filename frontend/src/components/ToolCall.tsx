import { useState } from "react";
import { resolveToolCallIcon, resolveToolCallLabel } from "../utils/toolCallIcons";
import ToolCallDetails from "./ToolCallDetails";

interface ToolCallProps {
  toolCallId: string;
  name: string;
  args: string;
  status: "executing" | "completed" | "failed";
  result?: string;
  isFirstInSequence?: boolean;
  isLastInSequence?: boolean;
}

export default function ToolCall({
  toolCallId: _toolCallId,
  name,
  args,
  status,
  result,
  isFirstInSequence: _isFirst,
  isLastInSequence: _isLast,
}: ToolCallProps) {
  const [expanded, setExpanded] = useState(false);

  const label = resolveToolCallLabel(name, args);

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 leading-none group transition-all duration-150 w-full text-left"
      >
        {/* Icon */}
        <svg
          className="w-4 h-4 shrink-0 text-chat-text-muted/50"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={resolveToolCallIcon(name)} />
        </svg>

        {/* Label */}
        <span className="text-xs text-chat-text-muted/70 group-hover:text-chat-text-muted transition-colors duration-150">
          {label}
        </span>


      </button>

      {expanded && (
        <div className="ml-6 mt-0.5 mb-1 rounded-lg overflow-hidden border border-chat-border/30 animate-fade-in">
          <ToolCallDetails name={name} args={args} result={result} error={status === "failed"} />
        </div>
      )}
    </div>
  );
}

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
  isFirstInSequence,
  isLastInSequence,
}: ToolCallProps) {
  const [expanded, setExpanded] = useState(false);

  let topClass = "rounded-xl";
  let midClass = "rounded-xl";
  let botClass = "rounded-xl";
  let borderT = "";

  if (isFirstInSequence && !isLastInSequence) {
    topClass = "rounded-t-xl";
    midClass = "rounded-t-xl";
    botClass = "rounded-b-none";
  } else if (!isFirstInSequence && isLastInSequence) {
    topClass = "rounded-t-none";
    midClass = "rounded-b-none";
    botClass = "rounded-b-xl";
    borderT = "border-t-0";
  } else if (!isFirstInSequence && !isLastInSequence) {
    topClass = "rounded-none";
    midClass = "rounded-none";
    botClass = "rounded-none";
    borderT = "border-t-0";
  }

  return (
    <div className={`mx-5 animate-fade-in`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 w-full px-3 py-1.5 bg-chat-surface/50 border border-chat-border/50 hover:bg-chat-surface/70 transition-all duration-200 ${topClass} ${borderT}`}
      >
        <div className="w-6 h-6 rounded-lg bg-[#83a598]/20 flex items-center justify-center shrink-0">
          <svg className="w-3.5 h-3.5 text-[#83a598]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={resolveToolCallIcon(name)} />
          </svg>
        </div>
        <span className="text-xs font-medium text-chat-text truncate">
          {resolveToolCallLabel(name)}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {status === "completed" && (
            <svg className="w-3.5 h-3.5 text-[#b8bb26]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {status === "failed" && (
            <svg className="w-3.5 h-3.5 text-[#fb4934]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <div className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}>
            <svg className="w-3 h-3 text-chat-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </button>
      {expanded && (
        <div className={`border-x border-b border-chat-border/50 overflow-hidden ${botClass}`}>
          <ToolCallDetails name={name} args={args} result={result} error={status === "failed"} />
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import type { Conversation } from "../stores/chatStore";
import { formatTitle } from "../lib/utils";
import { useSettingsStore } from "../stores/settingsStore";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: SidebarProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className={`flex flex-col bg-chat-sidebar border-r border-chat-border/50 transition-all duration-300 ${
        expanded ? "w-64" : "w-14"
      }`}
    >
      {/* header / branding */}
      <div className="flex items-center h-14 px-3 border-b border-chat-border/50 shrink-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-2 rounded-xl hover:bg-chat-surface transition-all duration-200 hover:scale-105 active:scale-95"
          title={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          <svg
            className="w-5 h-5 text-chat-text"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        {expanded && (
          <div className="ml-3 flex items-center gap-2 flex-1 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-[#83a598] flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-chat-text truncate">AI Chat</span>
            <div className="flex-1" />
            <button
              onClick={() => useSettingsStore.getState().open()}
              className="p-1.5 rounded-xl hover:bg-chat-surface transition-all duration-200 hover:scale-105 active:scale-95 shrink-0"
              title="Settings"
            >
              <svg className="w-4 h-4 text-chat-text-muted hover:text-chat-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        )}
        {!expanded && (
          <button
            onClick={() => useSettingsStore.getState().open()}
            className="ml-auto p-1.5 rounded-xl hover:bg-chat-surface transition-all duration-200"
            title="Settings"
          >
            <svg className="w-4 h-4 text-chat-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
      </div>

      {/* new chat button */}
      {expanded && (
        <div className="p-2 pt-3">
          <button
            onClick={onNew}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#83a598]/20 hover:bg-[#83a598]/30 text-chat-accent text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border border-chat-accent/20"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>
      )}

      {/* conversation list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {conversations.map((conv) => {
          const isActive = conv.id === activeId;
          return (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`group relative flex items-center rounded-xl cursor-pointer transition-all duration-200 ${
                isActive
                  ? "bg-[#83a598]/15 text-chat-text shadow-sm"
                  : "text-chat-text-muted hover:bg-chat-surface/60 hover:text-chat-text"
              } ${expanded ? "px-3 py-2.5" : "justify-center p-2.5"}`}
            >
              {/* active indicator bar */}
              {isActive && expanded && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-[#83a598]" />
              )}
              <div className={`flex items-center gap-2.5 min-w-0 ${expanded ? "w-full" : ""}`}>
                <svg
                  className={`w-4 h-4 shrink-0 ${isActive ? "text-[#83a598]" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
                {expanded && (
                  <>
                    <span className="text-sm truncate flex-1">{formatTitle(conv.title)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(conv.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/20 transition-all duration-200"
                    >
                      <svg
                        className="w-3.5 h-3.5 text-chat-text-muted hover:text-red-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
import { useCallback, useEffect, useRef } from "react";
import type { Conversation, StreamItem } from "../stores/chatStore";
import { useModelSelectorStore } from "../stores/modelSelectorStore";
import MessageBubble from "./MessageBubble";
import ThinkingBlock from "./ThinkingBlock";
import ToolCall from "./ToolCall";
import TypingIndicator from "./TypingIndicator";
import InputBar from "./InputBar";
import { formatTitle } from "../lib/utils";

interface ChatAreaProps {
  activeId: string;
  conversations: Conversation[];
  items: StreamItem[];
  streaming: boolean;
  waiting: boolean;
  connected: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

export default function ChatArea({
  activeId,
  conversations,
  items,
  streaming,
  waiting,
  connected,
  onSend,
  onStop,
}: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionsRef = useRef<Map<string, number>>(new Map());
  const prevActiveIdRef = useRef<string>(activeId);
  const isRestoringRef = useRef(false);
  const activeConv = conversations.find((c) => c.id === activeId);

  // Model selector
  const { selectedModel, selectedProvider, providers, initialized, init } = useModelSelectorStore();
  const selectedProviderInfo = providers.find((p) => p.id === selectedProvider);
  const displayModel = selectedModel || activeConv?.model || "AI Assistant";

  useEffect(() => {
    if (!initialized) init();
  }, [initialized, init]);

  // Helper: check if user is scrolled near bottom
  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    const threshold = 150;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // Save scroll position when switching away, restore when switching to
  useEffect(() => {
    const prevId = prevActiveIdRef.current;
    if (prevId && prevId !== activeId) {
      // Save the previous conversation's scroll position
      const el = scrollContainerRef.current;
      if (el) {
        scrollPositionsRef.current.set(prevId, el.scrollTop);
      }
    }
    prevActiveIdRef.current = activeId;
  }, [activeId]);

  // Restore scroll position after items load for a conversation
  useEffect(() => {
    if (!activeId || items.length === 0) return;
    const savedPos = scrollPositionsRef.current.get(activeId);
    if (savedPos !== undefined) {
      // Restore saved position
      isRestoringRef.current = true;
      requestAnimationFrame(() => {
        const el = scrollContainerRef.current;
        if (el) {
          el.scrollTop = savedPos;
        }
        // Allow auto-scroll again after a brief delay
        setTimeout(() => {
          isRestoringRef.current = false;
        }, 100);
      });
    } else {
      // New conversation or first load — scroll to bottom
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView();
      });
    }
    // Only run when activeId changes or items go from empty to populated
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, items.length > 0]);

  // Smart auto-scroll: only scroll to bottom on new items if user is near bottom
  useEffect(() => {
    if (isRestoringRef.current) return;
    if (isNearBottom()) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [items, isNearBottom]);

  return (
    <div className="flex flex-col flex-1 min-w-0 bg-chat-bg">
      {/* header */}
      <div className="flex items-center h-14 px-5 border-b border-chat-border/50 bg-chat-bg/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-semibold text-chat-text">
              {activeConv ? formatTitle(activeConv.title, 40) : "AI Chat"}
            </span>
            {activeConv && (
              <span className="text-[10px] text-chat-text-muted block leading-none mt-0.5 flex items-center gap-1.5">
                {(streaming || waiting) && (
                  <span className="flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_4px_rgba(129,140,248,0.6)]" />
                    <span className="text-indigo-400/80">Generating</span>
                  </span>
                )}
                {!(streaming || waiting) && (
                  <span className="flex items-center gap-1">
                    {selectedProviderInfo && (
                      <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${
                        selectedProviderInfo.type === 'openrouter' ? 'bg-blue-500/15 text-blue-400' :
                        selectedProviderInfo.type === 'openai' ? 'bg-green-500/15 text-green-400' :
                        'bg-purple-500/15 text-purple-400'
                      }`}>
                        {selectedProviderInfo.name}
                      </span>
                    )}
                    {displayModel}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-chat-surface/50">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connected ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]"
              }`}
            />
            <span className="text-[11px] text-chat-text-muted">
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>

      {/* messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto flex flex-col items-center">
        <div className="w-full max-w-3xl">
        {items.length === 0 && !streaming && !waiting ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/10">
                <svg
                  className="w-10 h-10 text-indigo-400/60"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-chat-text mb-2">Start a conversation</h2>
              <p className="text-sm text-chat-text-muted mb-6 leading-relaxed">
                Type a message or choose a suggestion below
              </p>
              <div className="grid gap-2">
                {[
                  { label: "Write a note", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
                  { label: "Search the web", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
                  { label: "Run a command", icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" },
                ].map((s) => (
                  <button
                    key={s.label}
                    onClick={() => onSend(s.label.toLowerCase())}
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-chat-surface/50 hover:bg-chat-surface border border-chat-border/50 hover:border-chat-border transition-all duration-200 text-sm text-chat-text-muted hover:text-chat-text group"
                  >
                    <svg
                      className="w-4 h-4 text-chat-text-muted group-hover:text-chat-accent transition-colors"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                    </svg>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4">
            {items.map((item, i) => {
              switch (item.kind) {
                case "user_message":
                case "assistant_message":
                  return <MessageBubble key={item.id} message={item} />;
                case "thought":
                  return <ThinkingBlock key={item.id} text={item.text} status={item.status} />;
                case "tool_call":
                  return (
                    <ToolCall
                      key={item.id}
                      toolCallId={item.toolCallId}
                      name={item.name}
                      args={item.args}
                      status={item.status}
                      result={item.result}
                      isFirstInSequence={
                        i === 0 || items[i - 1].kind !== "tool_call"
                      }
                      isLastInSequence={
                        i === items.length - 1 || items[i + 1].kind !== "tool_call"
                      }
                    />
                  );
                case "system_message":
                  return (
                    <div key={item.id} className="flex justify-center px-5 py-2 animate-fade-in">
                      <div className="bg-red-900/30 text-red-300 text-xs px-3.5 py-2 rounded-xl border border-red-800/30">
                        {item.text}
                      </div>
                    </div>
                  );
                default:
                  return null;
              }
            })}
            {waiting && !streaming && <TypingIndicator />}
          </div>
        )}
        <div ref={bottomRef} />
        </div>
      </div>

      {/* input */}
      <div className="flex justify-center">
        <div className="w-full max-w-3xl">
        {activeId ? (
          <InputBar onSend={onSend} onStop={onStop} disabled={!connected} streaming={streaming} waiting={waiting} />
        ) : (
          <div className="p-5 text-center text-xs text-chat-text-muted border-t border-chat-border/50">
            Create or select a conversation to start chatting
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
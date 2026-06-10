import { create } from "zustand";

export interface Conversation {
  id: string;
  title: string;
  last_preview?: string;
  created_at?: string;
  updated_at?: string;
  model?: string;
}

export interface UserMessageItem {
  kind: "user_message";
  id: string;
  text: string;
  timestamp: number;
}

export interface AssistantMessageItem {
  kind: "assistant_message";
  id: string;
  text: string;
  timestamp: number;
}

export type ThoughtStatus = "loading" | "ready";

export interface ThoughtItem {
  kind: "thought";
  id: string;
  text: string;
  timestamp: number;
  status: ThoughtStatus;
}

export type ToolCallStatus = "executing" | "completed" | "failed";

export interface ToolCallItem {
  kind: "tool_call";
  id: string;
  toolCallId: string;
  name: string;
  args: string;
  status: ToolCallStatus;
  result?: string;
  timestamp: number;
}

export interface SystemMessageItem {
  kind: "system_message";
  id: string;
  text: string;
  timestamp: number;
}

export type StreamItem = UserMessageItem | AssistantMessageItem | ThoughtItem | ToolCallItem | SystemMessageItem;

let idCounter = 0;
export function genId(): string {
  return `item_${++idCounter}`;
}

interface ChatState {
  conversations: Conversation[];
  activeId: string;
  items: StreamItem[];
  streamingHead: StreamItem[];
  streaming: boolean;
  waiting: boolean;
  connected: boolean;

  setConversations: (convs: Conversation[]) => void;
  setActiveId: (id: string) => void;
  setItems: (items: StreamItem[]) => void;
  appendItem: (item: StreamItem) => void;
  updateItemById: (id: string, updates: Partial<StreamItem>) => void;
  removeItemById: (id: string) => void;
  addToolCall: (toolCallId: string, name: string, args: string) => void;
  updateToolResult: (toolCallId: string, result: string) => void;
  setToolCallFailed: (toolCallId: string) => void;
  setStreaming: (v: boolean) => void;
  setWaiting: (v: boolean) => void;
  setConnected: (v: boolean) => void;
  clearStreamingHead: () => void;
  flushHead: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeId: "",
  items: [],
  streamingHead: [],
  streaming: false,
  waiting: false,
  connected: false,

  setConversations: (convs) => set({ conversations: convs }),
  setActiveId: (id) => set({ activeId: id }),
  setItems: (items) => set({ items }),
  appendItem: (item) => set((s) => ({ items: [...s.items, item] })),
  updateItemById: (id, updates) =>
    set((s) => ({
      items: s.items.map((item) =>
        item.id === id ? { ...item, ...updates } as StreamItem : item
      ),
    })),
  removeItemById: (id) =>
    set((s) => ({
      items: s.items.filter((item) => item.id !== id),
    })),
  addToolCall: (toolCallId, name, args) =>
    set((s) => ({
      items: [
        ...s.items,
        {
          kind: "tool_call",
          id: genId(),
          toolCallId,
          name,
          args,
          status: "executing" as const,
          timestamp: Date.now(),
        },
      ],
    })),
  updateToolResult: (toolCallId, result) =>
    set((s) => ({
      items: s.items.map((item) =>
        item.kind === "tool_call" && item.toolCallId === toolCallId
          ? { ...item, status: "completed" as const, result }
          : item
      ),
    })),
  setToolCallFailed: (toolCallId) =>
    set((s) => ({
      items: s.items.map((item) =>
        item.kind === "tool_call" && item.toolCallId === toolCallId
          ? { ...item, status: "failed" as const }
          : item
      ),
    })),
  setStreaming: (v) => set({ streaming: v }),
  setWaiting: (v) => set({ waiting: v }),
  setConnected: (v) => set({ connected: v }),
  clearStreamingHead: () => set({ streamingHead: [] }),
  flushHead: () =>
    set((s) => ({
      items: [...s.items, ...s.streamingHead],
      streamingHead: [],
    })),
}));

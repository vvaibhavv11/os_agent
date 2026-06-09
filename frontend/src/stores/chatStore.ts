import { create } from "zustand";

export interface Message {
  speaker: "user" | "ai" | "system";
  messageText: string;
  reasoningText?: string;
}

export interface Conversation {
  id: string;
  title: string;
  last_preview?: string;
  created_at?: string;
  updated_at?: string;
  model?: string;
}

interface ChatState {
  conversations: Conversation[];
  activeId: string;
  messages: Message[];
  streaming: boolean;
  waiting: boolean;
  connected: boolean;

  setConversations: (convs: Conversation[]) => void;
  setActiveId: (id: string) => void;
  setMessages: (msgs: Message[]) => void;
  appendMessage: (msg: Message) => void;
  updateLastMessage: (text: string, reasoning?: string) => void;
  setStreaming: (v: boolean) => void;
  setWaiting: (v: boolean) => void;
  setConnected: (v: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeId: "",
  messages: [],
  streaming: false,
  waiting: false,
  connected: false,

  setConversations: (convs) => set({ conversations: convs }),
  setActiveId: (id) => set({ activeId: id }),
  setMessages: (msgs) => set({ messages: msgs }),
  appendMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),
  updateLastMessage: (text, reasoning) =>
    set((s) => {
      const msgs = [...s.messages];
      if (msgs.length === 0) return s;
      const last = { ...msgs[msgs.length - 1] };
      last.messageText = text;
      if (reasoning !== undefined) last.reasoningText = reasoning;
      msgs[msgs.length - 1] = last;
      return { messages: msgs };
    }),
  setStreaming: (v) => set({ streaming: v }),
  setWaiting: (v) => set({ waiting: v }),
  setConnected: (v) => set({ connected: v }),
}));

import { useCallback } from "react";
import { useChatStore, genId, type StreamItem, type UserMessageItem, type AssistantMessageItem, type SystemMessageItem } from "./stores/chatStore";
import { useChatEvents } from "./hooks/useChat";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import {
  GetConversations,
  GetConversation,
  CreateConversation,
  DeleteConversation,
  SendMessage,
  StopGeneration,
} from "../wailsjs/go/main/App";

function App() {
  useChatEvents();

  const {
    conversations,
    activeId,
    items,
    streaming,
    waiting,
    connected,
    setActiveId,
    setItems,
    setConversations,
  } = useChatStore();

  const handleSelect = useCallback(
    (id: string) => {
      setActiveId(id);
      GetConversation(id).then((raw: string) => {
        const msgs = JSON.parse(raw);
        const streamItems: StreamItem[] = msgs.map((m: any) => {
          const base = {
            id: genId(),
            timestamp: Date.now(),
          };
          if (m.role === "user") {
            return { ...base, kind: "user_message" as const, text: m.content || "" } as UserMessageItem;
          }
          if (m.role === "system") {
            return { ...base, kind: "system_message" as const, text: m.content || "" } as SystemMessageItem;
          }
          return { ...base, kind: "assistant_message" as const, text: m.content || "" } as AssistantMessageItem;
        });
        setItems(streamItems);
      });
    },
    [setActiveId, setItems]
  );

  const handleNew = useCallback(() => {
    CreateConversation().then((raw: string) => {
      if (!raw) return;
      const conv = JSON.parse(raw);
      setActiveId(conv.id);
      setItems([]);
      GetConversations().then((raw2: string) => {
        setConversations(JSON.parse(raw2));
      });
    });
  }, [setActiveId, setItems, setConversations]);

  const handleDelete = useCallback(
    (id: string) => {
      DeleteConversation(id);
      if (id === activeId) {
        setActiveId("");
        setItems([]);
      }
    },
    [activeId, setActiveId, setItems]
  );

  const handleSend = useCallback(
    (text: string) => {
      if (!activeId) return;
      useChatStore.getState().appendItem({
        kind: "user_message",
        id: genId(),
        text,
        timestamp: Date.now(),
      });
      useChatStore.getState().setWaiting(true);
      SendMessage(text, activeId);
    },
    [activeId]
  );

  const handleStop = useCallback(() => {
    StopGeneration();
  }, []);

  return (
    <div className="flex h-screen w-screen bg-chat-bg">
      <Sidebar
        conversations={conversations || []}
        activeId={activeId}
        onSelect={handleSelect}
        onNew={handleNew}
        onDelete={handleDelete}
      />
      <ChatArea
        activeId={activeId}
        conversations={conversations || []}
        items={items || []}
        streaming={streaming}
        waiting={waiting}
        connected={connected}
        onSend={handleSend}
        onStop={handleStop}
      />
    </div>
  );
}

export default App;

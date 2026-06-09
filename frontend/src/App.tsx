import { useCallback } from "react";
import { useChatStore } from "./stores/chatStore";
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
    messages,
    streaming,
    waiting,
    connected,
    setActiveId,
    setMessages,
    setConversations,
  } = useChatStore();

  const handleSelect = useCallback(
    (id: string) => {
      setActiveId(id);
      GetConversation(id).then((raw: string) => {
        const msgs = JSON.parse(raw);
        setMessages(
          msgs.map((m: any) => ({
            speaker: m.role === "user" ? "user" : "ai",
            messageText: m.content || "",
            reasoningText: m.reasoning || "",
          }))
        );
      });
    },
    [setActiveId, setMessages]
  );

  const handleNew = useCallback(() => {
    CreateConversation().then((raw: string) => {
      if (!raw) return;
      const conv = JSON.parse(raw);
      setActiveId(conv.id);
      setMessages([]);
      GetConversations().then((raw2: string) => {
        setConversations(JSON.parse(raw2));
      });
    });
  }, [setActiveId, setMessages, setConversations]);

  const handleDelete = useCallback(
    (id: string) => {
      DeleteConversation(id);
      if (id === activeId) {
        setActiveId("");
        setMessages([]);
      }
    },
    [activeId, setActiveId, setMessages]
  );

  const handleSend = useCallback(
    (text: string) => {
      if (!activeId) return;
      // Optimistically append user message
      useChatStore.getState().appendMessage({
        speaker: "user",
        messageText: text,
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
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelect}
        onNew={handleNew}
        onDelete={handleDelete}
      />
      <ChatArea
        activeId={activeId}
        conversations={conversations}
        messages={messages}
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

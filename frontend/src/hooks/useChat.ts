import { useEffect, useRef } from "react";
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";
import {
  GetConversations,
  GetConversation,
} from "../../wailsjs/go/main/App";
import { useChatStore, type Message } from "../stores/chatStore";

export function useChatEvents() {
  const {
    setConversations,
    setActiveId,
    setMessages,
    appendMessage,
    updateLastMessage,
    setStreaming,
    setWaiting,
    setConnected,
  } = useChatStore();

  const textBuf = useRef("");
  const reasoningBuf = useRef("");
  const ignoreStale = useRef(false);

  useEffect(() => {
    // Load initial data via Go bindings (avoids race with startup event)
    ignoreStale.current = false;
    setConnected(true);
    GetConversations().then((raw: string) => {
      const convs = JSON.parse(raw);
      setConversations(convs);
      if (convs.length > 0) {
        setActiveId(convs[0].id);
        GetConversation(convs[0].id).then((raw2: string) => {
          const msgs = JSON.parse(raw2);
          setMessages(
            msgs.map((m: any) => ({
              speaker: m.role === "user" ? "user" : "ai",
              messageText: m.content || "",
              reasoningText: m.reasoning || "",
            }))
          );
        });
      }
    });

    const unsubs: (() => void)[] = [];

    const on = (event: string, handler: (...args: unknown[]) => void) => {
      EventsOn(event, handler);
      unsubs.push(() => EventsOff(event));
    };

    on("conversations_update", (data: any) => {
      setConversations(data.conversations || []);
      if (data.active_id) setActiveId(data.active_id);
    });

    on("conversation_renamed", (data: any) => {
      const state = useChatStore.getState();
      const updated = state.conversations.map((c: any) =>
        c.id === data.id ? { ...c, title: data.title } : c
      );
      setConversations(updated);
    });

    on("conversation_deleted", (_data: any) => {
      // handled by conversations_update
    });

    on("conversation_loaded", (data: any) => {
      if (data.id !== useChatStore.getState().activeId) return;
      const msgs: Message[] = (data.messages || []).map((m: any) => ({
        speaker: m.role === "user" ? "user" : "ai",
        messageText: m.content || "",
        reasoningText: m.reasoning || "",
      }));
      setMessages(msgs);
    });

    on("text_delta", (data: any) => {
      if (ignoreStale.current) return;
      setWaiting(false);
      const { streaming } = useChatStore.getState();
      if (!streaming) {
        setStreaming(true);
        textBuf.current = "";
        reasoningBuf.current = "";
        appendMessage({ speaker: "ai", messageText: "", reasoningText: "" });
      }
      textBuf.current += data.content;
      updateLastMessage(textBuf.current, reasoningBuf.current);
    });

    on("reasoning_delta", (data: any) => {
      if (ignoreStale.current) return;
      setWaiting(false);
      const { streaming } = useChatStore.getState();
      if (!streaming) {
        setStreaming(true);
        textBuf.current = "";
        reasoningBuf.current = "";
        appendMessage({ speaker: "ai", messageText: "", reasoningText: "" });
      }
      reasoningBuf.current += data.content;
      updateLastMessage(textBuf.current, reasoningBuf.current);
    });

    on("tool_call", (data: any) => {
      if (ignoreStale.current) return;
      setWaiting(false);
      const { streaming } = useChatStore.getState();
      if (!streaming) {
        setStreaming(true);
        textBuf.current = "";
        reasoningBuf.current = "";
        appendMessage({ speaker: "ai", messageText: "", reasoningText: "" });
      }
      textBuf.current += `\n\n*Using ${data.name}()...*`;
      updateLastMessage(textBuf.current, reasoningBuf.current);
    });

    on("tool_result", (_data: any) => {
      if (ignoreStale.current) return;
      textBuf.current += `\n\n*Done.*`;
      updateLastMessage(textBuf.current, reasoningBuf.current);
    });

    on("finish", (_data: any) => {
      if (ignoreStale.current) return;
      setWaiting(false);
      setStreaming(false);
      textBuf.current = "";
      reasoningBuf.current = "";
    });

    on("error", (data: any) => {
      if (ignoreStale.current) return;
      setWaiting(false);
      setStreaming(false);
      appendMessage({
        speaker: "system",
        messageText: "Error: " + (data.message || "Unknown error"),
      });
    });

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, []);

  return { ignoreStale };
}

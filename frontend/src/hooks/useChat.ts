import { useEffect, useRef } from "react";
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";
import {
  GetConversations,
  GetConversation,
} from "../../wailsjs/go/main/App";
import { useChatStore, genId, storedMessagesToItems } from "../stores/chatStore";

export function useChatEvents() {
  const store = useChatStore;

  const textBuf = useRef("");
  const reasoningBuf = useRef("");
  const thoughtItemId = useRef<string | null>(null);

  useEffect(() => {
    store.getState().setConnected(true);
    GetConversations().then((raw: string) => {
      const convs = JSON.parse(raw) || [];
      store.getState().setConversations(convs);
      if (convs.length > 0) {
        store.getState().setActiveId(convs[0].id);
        GetConversation(convs[0].id).then((raw2: string) => {
          const msgs = JSON.parse(raw2) || [];
          store.getState().setItems(storedMessagesToItems(msgs));
        });
      }
    });

    const unsubs: (() => void)[] = [];

    const on = (event: string, handler: (...args: unknown[]) => void) => {
      EventsOn(event, handler);
      unsubs.push(() => EventsOff(event));
    };

    on("conversations_update", (data: any) => {
      store.getState().setConversations(data.conversations || []);
      if (data.active_id) store.getState().setActiveId(data.active_id);
    });

    on("conversation_renamed", (data: any) => {
      const state = store.getState();
      const updated = state.conversations.map((c: any) =>
        c.id === data.id ? { ...c, title: data.title } : c
      );
      store.getState().setConversations(updated);
    });

    on("conversation_deleted", () => {});

    on("conversation_loaded", (data: any) => {
      if (data.id !== store.getState().activeId) return;
      if (store.getState().items.length > 0) return;
      store.getState().setItems(storedMessagesToItems(data.messages || []));
    });

    on("reasoning_start", () => {
      const id = genId();
      thoughtItemId.current = id;
      store.getState().appendItem({
        kind: "thought",
        id,
        text: "",
        timestamp: Date.now(),
        status: "loading",
      });
    });

    on("reasoning_delta", (data: any) => {
      store.getState().setWaiting(false);
      if (!thoughtItemId.current) {
        const id = genId();
        thoughtItemId.current = id;
        store.getState().appendItem({
          kind: "thought",
          id,
          text: "",
          timestamp: Date.now(),
          status: "loading",
        });
      }
      reasoningBuf.current += data.content;
      store.getState().updateItemById(thoughtItemId.current, {
        text: reasoningBuf.current,
      } as any);
    });

    const ensureAssistantTurn = () => {
      const state = store.getState();
      if (state.streaming) return;
      store.getState().setStreaming(true);
      textBuf.current = "";
      reasoningBuf.current = "";
      if (thoughtItemId.current) {
        store.getState().updateItemById(thoughtItemId.current, { status: "ready" } as any);
        thoughtItemId.current = null;
      }
      store.getState().appendItem({
        kind: "assistant_message",
        id: genId(),
        text: "",
        timestamp: Date.now(),
      });
    };

    on("text_delta", (data: any) => {
      store.getState().setWaiting(false);
      ensureAssistantTurn();
      textBuf.current += data.content;
      const items = store.getState().items;
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].kind === "assistant_message") {
          store.getState().updateItemById(items[i].id, { text: textBuf.current } as any);
          break;
        }
      }
    });

    on("tool_call", (data: any) => {
      store.getState().setWaiting(false);
      ensureAssistantTurn();
      store.getState().addToolCall(data.toolCallId, data.name, data.args);
    });

    on("tool_result", (data: any) => {
      store.getState().updateToolResult(data.toolCallId, data.result);
    });

    on("step_finish", () => {
      store.getState().setStreaming(false);
    });

    on("finish", () => {
      store.getState().setStreaming(false);
      store.getState().setWaiting(false);
      if (thoughtItemId.current) {
        store.getState().updateItemById(thoughtItemId.current, { status: "ready" } as any);
        thoughtItemId.current = null;
      }
      textBuf.current = "";
      reasoningBuf.current = "";
    });

    on("error", (data: any) => {
      store.getState().setStreaming(false);
      store.getState().setWaiting(false);
      store.getState().appendItem({
        kind: "system_message",
        id: genId(),
        text: "Error: " + (data.message || "Unknown error"),
        timestamp: Date.now(),
      });
    });

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, []);

  return {};
}

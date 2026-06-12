package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/zendev-sh/goai"
	"github.com/zendev-sh/goai/provider"
	"github.com/zendev-sh/goai/provider/compat"
	"github.com/zendev-sh/goai/provider/openai"
	"github.com/zendev-sh/goai/provider/openrouter"
)

var activeProvider provider.LanguageModel

func getProvider() provider.LanguageModel {
	if activeProvider != nil {
		return activeProvider
	}

	s, err := loadSettingsFromFile()
	if err == nil && s != nil && s.ActiveProvider != "" && len(s.Providers) > 0 {
		var active *ProviderConfig
		for _, p := range s.Providers {
			if p.ID == s.ActiveProvider {
				active = &p
				break
			}
		}
		if active == nil {
			active = &s.Providers[0]
		}
		apiKey := decrypt(active.APIKey)
		switch active.Type {
		case "openrouter":
			if active.BaseURL != "" && active.BaseURL != defaultBaseURL("openrouter") {
				activeProvider = openrouter.Chat(active.Model, openrouter.WithAPIKey(apiKey), openrouter.WithBaseURL(active.BaseURL))
			} else {
				activeProvider = openrouter.Chat(active.Model, openrouter.WithAPIKey(apiKey))
			}
		case "openai":
			if active.BaseURL != "" && active.BaseURL != defaultBaseURL("openai") {
				activeProvider = openai.Chat(active.Model, openai.WithAPIKey(apiKey), openai.WithBaseURL(active.BaseURL))
			} else {
				activeProvider = openai.Chat(active.Model, openai.WithAPIKey(apiKey))
			}
		case "compat":
			if active.BaseURL != "" {
				opts := []compat.Option{compat.WithBaseURL(active.BaseURL)}
				if apiKey != "" {
					opts = append(opts, compat.WithAPIKey(apiKey))
				}
				activeProvider = compat.Chat(active.Model, opts...)
			}
		}
		if activeProvider != nil {
			return activeProvider
		}
	}

	// Fallback: env vars
	providerName := os.Getenv("AI_PROVIDER")
	if providerName == "" {
		providerName = "openrouter"
	}

	switch providerName {
	case "openrouter":
		model := os.Getenv("OPENROUTER_MODEL")
		if model == "" {
			model = "openrouter/owl-alpha"
		}
		if key := os.Getenv("OPENROUTER_API_KEY"); key != "" {
			activeProvider = openrouter.Chat(model, openrouter.WithAPIKey(key))
		} else {
			activeProvider = openrouter.Chat(model)
		}
	case "openai":
		model := os.Getenv("AI_MODEL")
		if model == "" {
			model = "gpt-4o-mini"
		}
		if key := os.Getenv("OPENAI_API_KEY"); key != "" {
			activeProvider = openai.Chat(model, openai.WithAPIKey(key))
		} else {
			activeProvider = openai.Chat(model)
		}
	}

	return activeProvider
}

func storedToGoAIMessages(msgs []StoredMessage) []provider.Message {
	var out []provider.Message
	for _, m := range msgs {
		switch m.Role {
		case "user":
			text := ""
			if m.Content != nil {
				text = *m.Content
			}
			out = append(out, goai.UserMessage(text))
		case "assistant":
			text := ""
			if m.Content != nil {
				text = *m.Content
			}
			parts := []provider.Part{
				{Type: provider.PartText, Text: text},
			}
			// Restore tool calls if present
			if m.ToolCalls != nil && *m.ToolCalls != "" {
				var tcs []struct {
					ToolCallID string `json:"toolCallId"`
					ToolName   string `json:"toolName"`
					Input      json.RawMessage `json:"input"`
				}
				if err := json.Unmarshal([]byte(*m.ToolCalls), &tcs); err == nil {
					for _, tc := range tcs {
						parts = append(parts, provider.Part{
							Type:       provider.PartToolCall,
							ToolCallID: tc.ToolCallID,
							ToolName:   tc.ToolName,
							ToolInput:  tc.Input,
						})
					}
				}
			}
			// Add reasoning if present
			if m.Reasoning != nil && *m.Reasoning != "" {
				parts = append([]provider.Part{
					{Type: provider.PartReasoning, Text: *m.Reasoning},
				}, parts...)
			}
			out = append(out, provider.Message{
				Role:    provider.RoleAssistant,
				Content: parts,
			})
		case "tool":
			if m.ToolCallID != nil && m.ToolName != nil && m.ToolResult != nil {
				out = append(out, goai.ToolMessage(*m.ToolCallID, *m.ToolName, *m.ToolResult))
			}
		}
	}
	return out
}

func agentSystemPrompt() string {
	return `You are a helpful desktop AI assistant that helps the user with their daily computer tasks. You have access to four tools:

- **write(path, content)** — Write content to a file (notes, documents, code snippets, etc.). Creates parent directories automatically. Use for new files or complete rewrites.
- **edit(filePath, edits[])** — Edit a file using exact text replacement. Each edits[].oldText must match a unique region of the file. Supports multiple edits in one call. Use for precise changes to existing files.
- **bash(command)** — Execute a bash command on the system. Use this to check system info, manage files, install packages, or run programs.
- **webSearch(query)** — Search the web for current information, news, or any data from the internet. Use this when you need up-to-date information or facts you're not sure about.

You can help with anything: answering questions, writing notes, managing files, checking system information, running programs, researching topics, organizing data, and more. Be conversational, helpful, and proactive. When you use tools, explain what you're doing in a natural way.`
}

func (a *App) runAgent(ctx context.Context, conversationID string, msgs []provider.Message) {
	model := getProvider()
	if model == nil {
		a.emitError("No AI provider configured. Open Settings (gear icon) to add your API key.")
		return
	}

	tools := []goai.Tool{
		makeWriteTool(),
		makeEditTool(),
		makeBashTool(),
		makeWebSearchTool(),
	}

	stream, err := goai.StreamText(ctx, model,
		goai.WithMessages(msgs...),
		goai.WithSystem(agentSystemPrompt()),
		goai.WithTools(tools...),
		goai.WithMaxSteps(30),
	)
	if err != nil {
		if ctx.Err() != nil {
			a.emitEvent("finish", nil)
			return
		}
		a.emitError(fmt.Sprintf("Failed to start stream: %v", err))
		return
	}

	var assistantContent strings.Builder
	var assistantReasoning strings.Builder
	var stepText strings.Builder
	var stepReasoning strings.Builder
	var toolCalls []toolCallInfo
	var toolResults []toolResultInfo
	var stepCount int
	assistantContent.Reset()
	assistantReasoning.Reset()

	for chunk := range stream.Stream() {
		switch chunk.Type {
		case provider.ChunkText:
			assistantContent.WriteString(chunk.Text)
			stepText.WriteString(chunk.Text)
			a.emitEvent("text_delta", map[string]any{"content": chunk.Text})
	case provider.ChunkReasoning:
		if stepReasoning.Len() == 0 {
			a.emitEvent("reasoning_start", nil)
		}
		assistantReasoning.WriteString(chunk.Text)
		stepReasoning.WriteString(chunk.Text)
		a.emitEvent("reasoning_delta", map[string]any{"content": chunk.Text})
		case provider.ChunkToolCall:
			toolCalls = append(toolCalls, toolCallInfo{
				ToolCallID: chunk.ToolCallID,
				ToolName:   chunk.ToolName,
				Input:      json.RawMessage(chunk.ToolInput),
			})
		a.emitEvent("tool_call", map[string]any{
			"toolCallId": chunk.ToolCallID,
			"name":       chunk.ToolName,
			"args":       chunk.ToolInput,
		})
		case provider.ChunkToolResult:
			toolResults = append(toolResults, toolResultInfo{
				toolCallID: chunk.ToolCallID,
				toolName:   chunk.ToolName,
				output:     chunk.ToolInput,
			})
		a.emitEvent("tool_result", map[string]any{
			"toolCallId": chunk.ToolCallID,
			"name":       chunk.ToolName,
			"result":     chunk.ToolInput,
		})
		case provider.ChunkStepFinish:
			stepCount++
			log.Printf("[chat] step %d tools:%d text:%d", stepCount, len(toolCalls), stepText.Len())
			persistStep(conversationID, stepText.String(), stepReasoning.String(), toolCalls, toolResults)
			stepText.Reset()
			stepReasoning.Reset()
			toolCalls = nil
			toolResults = nil
			a.emitEvent("step_finish", nil)
		case provider.ChunkFinish:
			stepCount++
			persistStep(conversationID, stepText.String(), stepReasoning.String(), toolCalls, toolResults)
			preview := assistantContent.String()
			if preview == "" {
				preview = "(processed with tools)"
			}
			if len(preview) > 60 {
				preview = preview[:60]
			}
			a.storage.UpdateConversation(conversationID, map[string]any{
				"last_preview": preview,
				"updated_at":   time.Now().UTC().Format(time.RFC3339),
			})
			a.storage.WriteJSONMirror(conversationID)
			a.emitEvent("finish", nil)
			convs, _ := a.storage.ListConversations()
			a.emitEvent("conversations_update", map[string]any{
				"conversations": convs,
				"active_id":     conversationID,
			})
		case provider.ChunkError:
			errMsg := "Unknown error"
			if chunk.Error != nil {
				errMsg = chunk.Error.Error()
			}
			a.emitError(errMsg)
		}
	}

	// If the context was canceled, emit finish to reset frontend state
	if ctx.Err() != nil {
		a.emitEvent("finish", nil)
	}
}

func persistStep(conversationID, text, reasoning string, tc []toolCallInfo, tr []toolResultInfo) {
	if text == "" && len(tc) == 0 {
		return
	}
	var textPtr *string
	if text != "" {
		textPtr = &text
	}
	var reasoningPtr *string
	if reasoning != "" {
		reasoningPtr = &reasoning
	}
	var tcsPtr *string
	if len(tc) > 0 {
		data, _ := json.Marshal(tc)
		s := string(data)
		tcsPtr = &s
	}
	msgs := []StoredMessage{{
		Role:      "assistant",
		Content:   textPtr,
		Reasoning: reasoningPtr,
		ToolCalls: tcsPtr,
	}}
	for _, r := range tr {
		id, name, out := r.toolCallID, r.toolName, r.output
		msgs = append(msgs, StoredMessage{
			Role:       "tool",
			ToolCallID: &id,
			ToolName:   &name,
			ToolResult: &out,
		})
	}
	a := globalApp
	if a != nil && a.storage != nil {
		a.storage.AppendMessages(conversationID, msgs)
	}
}

type toolCallInfo struct {
	ToolCallID string          `json:"toolCallId"`
	ToolName   string          `json:"toolName"`
	Input      json.RawMessage `json:"input"`
}

type toolResultInfo struct {
	toolCallID string
	toolName   string
	output     string
}

var globalApp *App

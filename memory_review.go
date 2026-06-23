package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/zendev-sh/goai"
	"github.com/zendev-sh/goai/provider"
)

const reviewPrompt = `Review the conversation above and consider saving to memory if appropriate.

Focus on:
1. Has the user revealed things about themselves — their persona, desires, preferences, or personal details worth remembering?
2. Has the user expressed expectations about how you should behave, their work style, or ways they want you to operate?

If something stands out, save it using the memory tool.
If nothing is worth saving, just say 'Nothing to save.' and stop.

You can ONLY use the memory tool. Other tools are not available.`

type reviewActionCollector struct {
	mu      sync.Mutex
	actions []string
}

func (c *reviewActionCollector) add(desc string) {
	c.mu.Lock()
	c.actions = append(c.actions, desc)
	c.mu.Unlock()
}

func (c *reviewActionCollector) snapshot() []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]string, len(c.actions))
	copy(out, c.actions)
	return out
}

func (a *App) spawnMemoryReview(ctx context.Context, conversationID string, msgs []provider.Message) {
	if a.memoryStore == nil || (!a.memoryStore.IsEnabled("memory") && !a.memoryStore.IsEnabled("user")) {
		return
	}

	go func() {
		// Serialize with the main agent's memory operations
		a.memoryReviewMu.Lock()
		defer a.memoryReviewMu.Unlock()

		log.Printf("[memory] background review starting for %s", conversationID)

		reviewCtx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
		defer cancel()

		reviewMsgs := make([]provider.Message, len(msgs))
		copy(reviewMsgs, msgs)
		reviewMsgs = append(reviewMsgs, provider.Message{
			Role: provider.RoleUser,
			Content: []provider.Part{
				{Type: provider.PartText, Text: reviewPrompt},
			},
		})

		collector := &reviewActionCollector{}

		memTool := makeMemoryTool(a.memoryStore, nil, collector)

		model := getProvider()
		if model == nil {
			return
		}

		stream, err := goai.StreamText(reviewCtx, model,
			goai.WithMessages(reviewMsgs...),
			goai.WithTools(memTool),
			goai.WithMaxSteps(5),
		)
		if err != nil {
			log.Printf("[memory] background review stream error: %v", err)
			return
		}

		for chunk := range stream.Stream() {
			switch chunk.Type {
			case provider.ChunkError:
				if chunk.Error != nil {
					log.Printf("[memory] background review chunk error: %v", chunk.Error)
				}
			case provider.ChunkFinish:
			case provider.ChunkStepFinish:
			case provider.ChunkToolCall:
			case provider.ChunkToolResult:
				desc := summarizeMemoryAction(chunk.ToolName, chunk.ToolInput)
				if desc != "" {
					collector.add(desc)
				}
			}
		}

		actions := collector.snapshot()
		if len(actions) > 0 {
			summary := strings.Join(actions, " · ")
			log.Printf("[memory] background review: %s", summary)

			a.emitEvent("memory_review", map[string]any{
				"actions": actions,
				"summary": summary,
			})
		}

		log.Printf("[memory] background review complete for %s (%d actions)", conversationID, len(actions))
	}()
}

func summarizeMemoryAction(toolName, resultJSON string) string {
	if toolName != "memory" {
		return ""
	}
	var res struct {
		Success bool   `json:"success"`
		Target  string `json:"target"`
		Message string `json:"message"`
		Action  *struct {
			Action  string `json:"action"`
			Target  string `json:"target"`
			Content string `json:"content,omitempty"`
		} `json:"action_info"`
	}
	if err := json.Unmarshal([]byte(resultJSON), &res); err != nil {
		return ""
	}
	if !res.Success || res.Action == nil {
		return ""
	}

	label := "memory"
	if res.Action.Target == "user" || res.Target == "user" {
		label = "user profile"
	}

	content := strings.TrimSpace(res.Action.Content)
	if len(content) > 60 {
		content = content[:60] + "..."
	}

	switch res.Action.Action {
	case "add":
		return fmt.Sprintf("Added to %s: '%s'", label, content)
	case "replace":
		return fmt.Sprintf("Updated %s: '%s'", label, content)
	case "remove":
		return fmt.Sprintf("Removed from %s", label)
	default:
		return ""
	}
}

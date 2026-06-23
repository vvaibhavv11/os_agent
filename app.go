package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx                   context.Context
	storage               *Storage
	cancelFn              context.CancelFunc
	cancelMu              sync.Mutex
	memoryStore           *MemoryStore
	memoryNudgeInterval   int
	turnsSinceMemoryNudge atomic.Int32
	memoryReviewMu        sync.Mutex
}

func NewApp() *App {
	return &App{
		memoryNudgeInterval: 10,
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	globalApp = a

	storage, err := NewStorage()
	if err != nil {
		runtime.LogErrorf(ctx, "Failed to init storage: %v", err)
		return
	}
	a.storage = storage
	runtime.LogInfo(ctx, "AI Chat Desktop started")

	// Load memory settings
	memoryEnabled := true
	userProfileEnabled := true
	memoryCharLimit := 2200
	userCharLimit := 1375
	nudgeInterval := 10

	s, err := loadSettingsFromFile()
	if err == nil && s != nil {
		if s.MemoryEnabled != nil {
			memoryEnabled = *s.MemoryEnabled
		}
		if s.UserProfileEnabled != nil {
			userProfileEnabled = *s.UserProfileEnabled
		}
		if s.MemoryCharLimit > 0 {
			memoryCharLimit = s.MemoryCharLimit
		}
		if s.UserCharLimit > 0 {
			userCharLimit = s.UserCharLimit
		}
		if s.NudgeInterval > 0 {
			nudgeInterval = s.NudgeInterval
		}
	}
	a.memoryNudgeInterval = nudgeInterval

	if memoryEnabled || userProfileEnabled {
		store := NewMemoryStore("", memoryCharLimit, userCharLimit, memoryEnabled, userProfileEnabled)
		store.LoadFromDisk()
		a.memoryStore = store
		runtime.LogInfo(ctx, "Memory store initialized")
	}

	// Emit init event with existing conversations
	convs, err := storage.ListConversations()
	if err != nil {
		runtime.LogErrorf(ctx, "ListConversations: %v", err)
		return
	}
	var activeID string
	if len(convs) > 0 {
		activeID = convs[0].ID
	}
	runtime.EventsEmit(ctx, "init", map[string]any{
		"conversations": convs,
		"active_id":     activeID,
	})
	if activeID != "" {
		msgs, err := storage.GetMessages(activeID)
		if err != nil {
			runtime.LogErrorf(ctx, "GetMessages: %v", err)
			return
		}
		runtime.EventsEmit(ctx, "conversation_loaded", map[string]any{
			"id":       activeID,
			"messages": msgs,
		})
	}
}

func (a *App) emitEvent(event string, data map[string]any) {
	if a.ctx == nil {
		return
	}
	runtime.EventsEmit(a.ctx, event, data)
}

func (a *App) emitError(msg string) {
	runtime.LogError(a.ctx, msg)
	runtime.EventsEmit(a.ctx, "error", map[string]any{"message": msg})
}

func (a *App) GetConversations() string {
	convs, err := a.storage.ListConversations()
	if err != nil {
		runtime.LogErrorf(a.ctx, "ListConversations: %v", err)
		return "[]"
	}
	data, _ := json.Marshal(convs)
	return string(data)
}

func (a *App) GetConversation(id string) string {
	msgs, err := a.storage.GetMessages(id)
	if err != nil {
		runtime.LogErrorf(a.ctx, "GetMessages: %v", err)
		return "[]"
	}
	clientMsgs := []ClientMessage{}
	for _, m := range msgs {
		content := ""
		if m.Content != nil {
			content = *m.Content
		}
		reasoning := ""
		if m.Reasoning != nil {
			reasoning = *m.Reasoning
		}
		clientMsgs = append(clientMsgs, ClientMessage{
			Role:      m.Role,
			Content:   content,
			Reasoning: reasoning,
			ToolCalls: m.ToolCalls,
		})
	}
	data, _ := json.Marshal(clientMsgs)
	return string(data)
}

func (a *App) CreateConversation() string {
	model := ""
	// Read model from settings file (active provider)
	if s, err := loadSettingsFromFile(); err == nil && s != nil {
		for _, p := range s.Providers {
			if p.ID == s.ActiveProvider {
				model = p.Model
				break
			}
		}
	}
	// Fallback to env var
	if model == "" {
		model = os.Getenv("OPENROUTER_MODEL")
	}
	if model == "" {
		model = "openrouter/owl-alpha"
	}
	conv, err := a.storage.CreateConversation("New Chat", model)
	if err != nil {
		a.emitError(fmt.Sprintf("CreateConversation: %v", err))
		return ""
	}
	data, _ := json.Marshal(conv)
	return string(data)
}

func (a *App) DeleteConversation(id string) {
	if err := a.storage.DeleteConversation(id); err != nil {
		a.emitError(fmt.Sprintf("DeleteConversation: %v", err))
	}
	convs, _ := a.storage.ListConversations()
	runtime.EventsEmit(a.ctx, "conversations_update", map[string]any{
		"conversations": convs,
	})
}

func (a *App) RenameConversation(id, title string) {
	if err := a.storage.UpdateConversation(id, map[string]any{
		"title":      title,
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	}); err != nil {
		a.emitError(fmt.Sprintf("RenameConversation: %v", err))
		return
	}
	runtime.EventsEmit(a.ctx, "conversation_renamed", map[string]any{
		"id":    id,
		"title": title,
	})
	convs, _ := a.storage.ListConversations()
	runtime.EventsEmit(a.ctx, "conversations_update", map[string]any{
		"conversations": convs,
	})
}

func (a *App) SendMessage(text, conversationID string) {
	if a.storage == nil {
		a.emitError("Storage not initialized")
		return
	}
	if text == "" || conversationID == "" {
		return
	}

	// Save user message
	a.storage.AppendMessages(conversationID, []StoredMessage{
		{Role: "user", Content: &text},
	})

	// Auto-title: use first user message if title is "New Chat"
	conv, err := a.storage.GetConversation(conversationID)
	if err == nil && conv != nil && conv.Title == "New Chat" {
		title := text
		if len(title) > 30 {
			title = title[:30] + "..."
		}
		now := time.Now().UTC().Format(time.RFC3339)
		a.storage.UpdateConversation(conversationID, map[string]any{
			"title":      title,
			"updated_at": now,
		})
		a.storage.WriteJSONMirror(conversationID)
		runtime.EventsEmit(a.ctx, "conversation_renamed", map[string]any{
			"id":    conversationID,
			"title": title,
		})
	}

	// Create cancellable context for this generation
	a.cancelMu.Lock()
	if a.cancelFn != nil {
		a.cancelFn()
	}
	ctx, cancel := context.WithCancel(context.Background())
	a.cancelFn = cancel
	a.cancelMu.Unlock()

	// Increment memory nudge counter
	if a.memoryStore != nil && a.memoryNudgeInterval > 0 {
		a.turnsSinceMemoryNudge.Add(1)
	}

	// Start streaming in a goroutine
	go func() {
		defer func() {
			a.cancelMu.Lock()
			a.cancelFn = nil
			a.cancelMu.Unlock()
		}()
		// Load full message history
		msgs, err := a.storage.GetMessages(conversationID)
		if err != nil {
			a.emitError(fmt.Sprintf("GetMessages: %v", err))
			return
		}
		goaiMsgs := storedToGoAIMessages(msgs)
		a.runAgent(ctx, conversationID, goaiMsgs)
	}()
}

func (a *App) resetMemoryNudge() {
	a.turnsSinceMemoryNudge.Store(0)
}

func (a *App) StopGeneration() {
	a.cancelMu.Lock()
	defer a.cancelMu.Unlock()
	if a.cancelFn != nil {
		a.cancelFn()
		a.cancelFn = nil
	}
}

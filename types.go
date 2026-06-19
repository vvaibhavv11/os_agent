package main

type Conversation struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
	LastPreview string `json:"last_preview"`
	Model       string `json:"model"`
}

type StoredMessage struct {
	Role       string  `json:"role"`
	Content    *string `json:"content"`
	ToolCalls  *string `json:"tool_calls,omitempty"`
	ToolCallID *string `json:"tool_call_id,omitempty"`
	ToolName   *string `json:"tool_name,omitempty"`
	ToolResult *string `json:"tool_result,omitempty"`
	Reasoning  *string `json:"reasoning,omitempty"`
}

type ClientMessage struct {
	Role      string  `json:"role"`
	Content   string  `json:"content"`
	Reasoning string  `json:"reasoning,omitempty"`
	ToolCalls *string `json:"tool_calls,omitempty"`
}

type ProviderConfig struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Type    string `json:"type"`
	APIKey  string `json:"api_key"`
	Model   string `json:"model"`
	BaseURL string `json:"base_url"`
}

type Settings struct {
	ActiveProvider     string           `json:"active_provider"`
	Providers          []ProviderConfig `json:"providers"`
	MemoryEnabled      *bool            `json:"memory_enabled,omitempty"`
	UserProfileEnabled *bool            `json:"user_profile_enabled,omitempty"`
	MemoryCharLimit    int              `json:"memory_char_limit,omitempty"`
	UserCharLimit      int              `json:"user_char_limit,omitempty"`
	NudgeInterval      int              `json:"nudge_interval,omitempty"`
}

type ModelInfo struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	ContextLength int    `json:"context_length,omitempty"`
}

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

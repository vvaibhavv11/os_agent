package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"modernc.org/sqlite"
)

const appDir = ".ai-chat"

type Storage struct {
	db *sql.DB
}

func NewStorage() (*Storage, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("home dir: %w", err)
	}
	dir := filepath.Join(home, appDir)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("mkdir: %w", err)
	}
	convDir := filepath.Join(dir, "conversations")
	if err := os.MkdirAll(convDir, 0755); err != nil {
		return nil, fmt.Errorf("mkdir conversations: %w", err)
	}

	db, err := sql.Open("sqlite", filepath.Join(dir, "conversations.db"))
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	// WAL mode
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return nil, fmt.Errorf("wal: %w", err)
	}

	s := &Storage{db: db}
	if err := s.initSchema(); err != nil {
		return nil, fmt.Errorf("schema: %w", err)
	}
	return s, nil
}

func (s *Storage) initSchema() error {
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS conversations (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL DEFAULT 'New Chat',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			last_preview TEXT DEFAULT '',
			model TEXT DEFAULT ''
		);
		CREATE TABLE IF NOT EXISTS messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			conversation_id TEXT NOT NULL REFERENCES conversations(id),
			role TEXT NOT NULL,
			content TEXT,
			tool_calls TEXT,
			tool_call_id TEXT,
			tool_name TEXT,
			tool_result TEXT,
			reasoning TEXT,
			created_at TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, id);
	`)
	return err
}

func uuidV4() string {
	b := make([]byte, 16)
	rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func (s *Storage) CreateConversation(title, model string) (*Conversation, error) {
	id := uuidV4()
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.Exec(
		"INSERT INTO conversations (id, title, created_at, updated_at, model) VALUES (?, ?, ?, ?, ?)",
		id, title, now, now, model,
	)
	if err != nil {
		return nil, err
	}
	return &Conversation{ID: id, Title: title, CreatedAt: now, UpdatedAt: now, Model: model}, nil
}

func (s *Storage) ListConversations() ([]Conversation, error) {
	rows, err := s.db.Query(
		"SELECT id, title, created_at, updated_at, COALESCE(last_preview,''), COALESCE(model,'') FROM conversations ORDER BY updated_at DESC",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	convs := make([]Conversation, 0)
	for rows.Next() {
		var c Conversation
		if err := rows.Scan(&c.ID, &c.Title, &c.CreatedAt, &c.UpdatedAt, &c.LastPreview, &c.Model); err != nil {
			return nil, err
		}
		convs = append(convs, c)
	}
	return convs, nil
}

func (s *Storage) GetConversation(id string) (*Conversation, error) {
	row := s.db.QueryRow(
		"SELECT id, title, created_at, updated_at, COALESCE(last_preview,''), COALESCE(model,'') FROM conversations WHERE id = ?", id,
	)
	var c Conversation
	err := row.Scan(&c.ID, &c.Title, &c.CreatedAt, &c.UpdatedAt, &c.LastPreview, &c.Model)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (s *Storage) UpdateConversation(id string, updates map[string]any) error {
	if len(updates) == 0 {
		return nil
	}
	var setClauses []string
	var vals []any
	for k, v := range updates {
		if k == "id" || k == "created_at" {
			continue
		}
		setClauses = append(setClauses, k+" = ?")
		vals = append(vals, v)
	}
	vals = append(vals, id)
	_, err := s.db.Exec(
		fmt.Sprintf("UPDATE conversations SET %s WHERE id = ?", joinStrings(setClauses, ", ")),
		vals...,
	)
	return err
}

func (s *Storage) DeleteConversation(id string) error {
	_, err := s.db.Exec("DELETE FROM messages WHERE conversation_id = ?", id)
	if err != nil {
		return err
	}
	_, err = s.db.Exec("DELETE FROM conversations WHERE id = ?", id)
	return err
}

func (s *Storage) AppendMessages(conversationID string, msgs []StoredMessage) error {
	now := time.Now().UTC().Format(time.RFC3339)
	stmt, err := s.db.Prepare(
		"INSERT INTO messages (conversation_id, role, content, tool_calls, tool_call_id, tool_name, tool_result, reasoning, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
	)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, m := range msgs {
		_, err := stmt.Exec(conversationID, m.Role, m.Content, m.ToolCalls, m.ToolCallID, m.ToolName, m.ToolResult, m.Reasoning, now)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Storage) GetMessages(conversationID string) ([]StoredMessage, error) {
	rows, err := s.db.Query(
		"SELECT role, content, tool_calls, tool_call_id, tool_name, tool_result, reasoning FROM messages WHERE conversation_id = ? ORDER BY id",
		conversationID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []StoredMessage
	for rows.Next() {
		var m StoredMessage
		if err := rows.Scan(&m.Role, &m.Content, &m.ToolCalls, &m.ToolCallID, &m.ToolName, &m.ToolResult, &m.Reasoning); err != nil {
			return nil, err
		}
		msgs = append(msgs, m)
	}
	return msgs, nil
}

func (s *Storage) WriteJSONMirror(conversationID string) error {
	conv, err := s.GetConversation(conversationID)
	if err != nil || conv == nil {
		return err
	}
	msgs, err := s.GetMessages(conversationID)
	if err != nil {
		return err
	}
	home, _ := os.UserHomeDir()
	path := filepath.Join(home, appDir, "conversations", conversationID+".json")
	data := map[string]any{
		"id":          conv.ID,
		"title":       conv.Title,
		"created_at":  conv.CreatedAt,
		"updated_at":  conv.UpdatedAt,
		"last_preview": conv.LastPreview,
		"model":       conv.Model,
		"messages":    msgs,
	}
	raw, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, raw, 0644)
}

func (s *Storage) Close() error {
	return s.db.Close()
}

func joinStrings(strs []string, sep string) string {
	if len(strs) == 0 {
		return ""
	}
	result := strs[0]
	for _, s := range strs[1:] {
		result += sep + s
	}
	return result
}

var _ = sqlite.Driver{} // ensure import

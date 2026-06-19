package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const entryDelimiter = "\n§\n"

type memoryActionInfo struct {
	Action  string `json:"action"`
	Target  string `json:"target"`
	Content string `json:"content,omitempty"`
	OldText string `json:"old_text,omitempty"`
}

type memoryToolResult struct {
	Success    bool              `json:"success"`
	Target     string            `json:"target"`
	Entries    []string          `json:"entries"`
	Usage      string            `json:"usage"`
	EntryCount int               `json:"entry_count"`
	Message    string            `json:"message,omitempty"`
	Error      string            `json:"error,omitempty"`
	Action     *memoryActionInfo `json:"action_info,omitempty"`
}

type MemoryStore struct {
	mu                sync.Mutex
	memoryDir         string
	memoryEntries     []string
	userEntries       []string
	snapshotMemory    string
	snapshotUser      string
	memoryCharLimit   int
	userCharLimit     int
	memoryEnabled     bool
	userProfileEnabled bool
}

func NewMemoryStore(memoryDir string, memoryCharLimit, userCharLimit int, memoryEnabled, userProfileEnabled bool) *MemoryStore {
	return &MemoryStore{
		memoryDir:          memoryDir,
		memoryCharLimit:    memoryCharLimit,
		userCharLimit:      userCharLimit,
		memoryEnabled:      memoryEnabled,
		userProfileEnabled: userProfileEnabled,
	}
}

func memoryDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, appDir, "memories")
}

func (s *MemoryStore) LoadFromDisk() {
	s.mu.Lock()
	defer s.mu.Unlock()

	dir := s.memoryDir
	if dir == "" {
		dir = memoryDir()
	}
	os.MkdirAll(dir, 0755)

	if s.memoryEnabled {
		s.memoryEntries = s.readFile(filepath.Join(dir, "MEMORY.md"))
	}
	if s.userProfileEnabled {
		s.userEntries = s.readFile(filepath.Join(dir, "USER.md"))
	}

	s.memoryEntries = dedupe(s.memoryEntries)
	s.userEntries = dedupe(s.userEntries)

	s.snapshotMemory = s.renderBlock("memory", s.memoryEntries)
	s.snapshotUser = s.renderBlock("user", s.userEntries)
}

func (s *MemoryStore) FormatForSystemPrompt(target string) string {
	switch target {
	case "memory":
		return s.snapshotMemory
	case "user":
		return s.snapshotUser
	}
	return ""
}

func (s *MemoryStore) Dispatch(action, target, content, oldText string) *memoryToolResult {
	switch action {
	case "add":
		return s.Add(target, content)
	case "replace":
		return s.Replace(target, oldText, content)
	case "remove":
		return s.Remove(target, oldText)
	default:
		return &memoryToolResult{
			Success: false,
			Error:   fmt.Sprintf("Unknown action '%s'. Use: add, replace, remove", action),
			Target:  target,
		}
	}
}

func (s *MemoryStore) Add(target, content string) *memoryToolResult {
	content = strings.TrimSpace(content)
	if content == "" {
		return &memoryToolResult{Success: false, Error: "Content cannot be empty.", Target: target}
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if drift := s.detectExternalDrift(target); drift != "" {
		return &memoryToolResult{Success: false, Error: drift, Target: target}
	}

	entries := s.entriesFor(target)
	limit := s.charLimit(target)

	for _, e := range entries {
		if e == content {
			return s.successResult(target, "Entry already exists (no duplicate added).", &memoryActionInfo{Action: "add", Target: target, Content: content})
		}
	}

	newEntries := append(entries, content)
	newTotal := len(strings.Join(newEntries, entryDelimiter))

	if newTotal > limit {
		current := s.charCount(target)
		return &memoryToolResult{
			Success: false,
			Target:  target,
			Error:   fmt.Sprintf("Memory at %d/%d chars. Adding this entry (%d chars) would exceed the limit.", current, limit, len(content)),
			Entries: entries,
			Usage:   s.usageStr(current, limit),
		}
	}

	entries = append(entries, content)
	s.setEntries(target, entries)
	s.writeFile(s.pathFor(target), entries)

	return s.successResult(target, "Entry added.", &memoryActionInfo{Action: "add", Target: target, Content: content})
}

func (s *MemoryStore) Replace(target, oldText, newContent string) *memoryToolResult {
	oldText = strings.TrimSpace(oldText)
	newContent = strings.TrimSpace(newContent)

	if oldText == "" {
		return &memoryToolResult{Success: false, Error: "old_text cannot be empty.", Target: target}
	}
	if newContent == "" {
		return &memoryToolResult{Success: false, Error: "new_content cannot be empty. Use 'remove' to delete entries.", Target: target}
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if drift := s.detectExternalDrift(target); drift != "" {
		return &memoryToolResult{Success: false, Error: drift, Target: target}
	}

	entries := s.entriesFor(target)
	limit := s.charLimit(target)

	var matches []int
	for i, e := range entries {
		if strings.Contains(e, oldText) {
			matches = append(matches, i)
		}
	}

	if len(matches) == 0 {
		return &memoryToolResult{Success: false, Error: fmt.Sprintf("No entry matched '%s'.", oldText), Target: target}
	}

	if len(matches) > 1 {
		unique := make(map[string]bool)
		for _, idx := range matches {
			unique[entries[idx]] = true
		}
		if len(unique) > 1 {
			previews := make([]string, 0, len(matches))
			for _, idx := range matches {
				e := entries[idx]
				if len(e) > 80 {
					e = e[:80] + "..."
				}
				previews = append(previews, e)
			}
			return &memoryToolResult{
				Success: false,
				Target:  target,
				Error:   fmt.Sprintf("Multiple entries matched '%s'. Be more specific.", oldText),
				Entries: previews,
			}
		}
	}

	idx := matches[0]

	testEntries := make([]string, len(entries))
	copy(testEntries, entries)
	testEntries[idx] = newContent
	newTotal := len(strings.Join(testEntries, entryDelimiter))

	if newTotal > limit {
		current := s.charCount(target)
		return &memoryToolResult{
			Success: false,
			Target:  target,
			Error:   fmt.Sprintf("Replacement would put memory at %d/%d chars. Shorten the new content, or remove other entries to make room.", newTotal, limit),
			Entries: entries,
			Usage:   s.usageStr(current, limit),
		}
	}

	entries[idx] = newContent
	s.setEntries(target, entries)
	s.writeFile(s.pathFor(target), entries)

	return s.successResult(target, "Entry replaced.", &memoryActionInfo{Action: "replace", Target: target, Content: newContent, OldText: oldText})
}

func (s *MemoryStore) Remove(target, oldText string) *memoryToolResult {
	oldText = strings.TrimSpace(oldText)
	if oldText == "" {
		return &memoryToolResult{Success: false, Error: "old_text cannot be empty.", Target: target}
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if drift := s.detectExternalDrift(target); drift != "" {
		return &memoryToolResult{Success: false, Error: drift, Target: target}
	}

	entries := s.entriesFor(target)

	var matches []int
	for i, e := range entries {
		if strings.Contains(e, oldText) {
			matches = append(matches, i)
		}
	}

	if len(matches) == 0 {
		return &memoryToolResult{Success: false, Error: fmt.Sprintf("No entry matched '%s'.", oldText), Target: target}
	}

	if len(matches) > 1 {
		unique := make(map[string]bool)
		for _, idx := range matches {
			unique[entries[idx]] = true
		}
		if len(unique) > 1 {
			previews := make([]string, 0, len(matches))
			for _, idx := range matches {
				e := entries[idx]
				if len(e) > 80 {
					e = e[:80] + "..."
				}
				previews = append(previews, e)
			}
			return &memoryToolResult{
				Success: false,
				Target:  target,
				Error:   fmt.Sprintf("Multiple entries matched '%s'. Be more specific.", oldText),
				Entries: previews,
			}
		}
	}

	idx := matches[0]
	entries = append(entries[:idx], entries[idx+1:]...)
	s.setEntries(target, entries)
	s.writeFile(s.pathFor(target), entries)

	return s.successResult(target, "Entry removed.", &memoryActionInfo{Action: "remove", Target: target, OldText: oldText})
}

func (s *MemoryStore) IsEnabled(target string) bool {
	switch target {
	case "memory":
		return s.memoryEnabled
	case "user":
		return s.userProfileEnabled
	}
	return false
}

func (s *MemoryStore) entriesFor(target string) []string {
	switch target {
	case "memory":
		return s.memoryEntries
	case "user":
		return s.userEntries
	}
	return nil
}

func (s *MemoryStore) setEntries(target string, entries []string) {
	switch target {
	case "memory":
		s.memoryEntries = entries
	case "user":
		s.userEntries = entries
	}
}

func (s *MemoryStore) charCount(target string) int {
	entries := s.entriesFor(target)
	if len(entries) == 0 {
		return 0
	}
	return len(strings.Join(entries, entryDelimiter))
}

func (s *MemoryStore) charLimit(target string) int {
	switch target {
	case "memory":
		return s.memoryCharLimit
	case "user":
		return s.userCharLimit
	}
	return 0
}

func (s *MemoryStore) pathFor(target string) string {
	dir := s.memoryDir
	if dir == "" {
		dir = memoryDir()
	}
	switch target {
	case "memory":
		return filepath.Join(dir, "MEMORY.md")
	case "user":
		return filepath.Join(dir, "USER.md")
	}
	return ""
}

func (s *MemoryStore) usageStr(current, limit int) string {
	pct := 0
	if limit > 0 {
		pct = int((float64(current) / float64(limit)) * 100)
	}
	return fmt.Sprintf("%d%% — %d/%d chars", pct, current, limit)
}

func (s *MemoryStore) renderBlock(target string, entries []string) string {
	if len(entries) == 0 {
		return ""
	}
	content := strings.Join(entries, entryDelimiter)
	current := len(content)
	limit := s.charLimit(target)
	pct := 0
	if limit > 0 {
		pct = int((float64(current) / float64(limit)) * 100)
	}

	var header string
	if target == "user" {
		header = fmt.Sprintf("USER PROFILE (who the user is) [%d%% — %d/%d chars]", pct, current, limit)
	} else {
		header = fmt.Sprintf("MEMORY (your personal notes) [%d%% — %d/%d chars]", pct, current, limit)
	}
	separator := strings.Repeat("═", 46)
	return fmt.Sprintf("%s\n%s\n%s\n%s", separator, header, separator, content)
}

func (s *MemoryStore) readFile(path string) []string {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	raw := string(data)
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, entryDelimiter)
	var out []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func (s *MemoryStore) writeFile(path string, entries []string) error {
	content := strings.Join(entries, entryDelimiter)
	dir := filepath.Dir(path)
	os.MkdirAll(dir, 0755)

	tmp, err := os.CreateTemp(dir, ".mem_*.tmp")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()

	if _, err := tmp.WriteString(content); err != nil {
		tmp.Close()
		os.Remove(tmpPath)
		return err
	}
	tmp.Close()

	return os.Rename(tmpPath, path)
}

func (s *MemoryStore) detectExternalDrift(target string) string {
	path := s.pathFor(target)
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	raw := string(data)
	if strings.TrimSpace(raw) == "" {
		return ""
	}

	parsed := s.readFile(path)
	if len(parsed) == 0 {
		return ""
	}
	roundtrip := strings.Join(parsed, entryDelimiter)

	limit := s.charLimit(target)
	maxLen := 0
	for _, e := range parsed {
		if len(e) > maxLen {
			maxLen = len(e)
		}
	}

	if strings.TrimSpace(raw) != strings.TrimSpace(roundtrip) || maxLen > limit {
		ts := time.Now().Unix()
		bakPath := path + fmt.Sprintf(".bak.%d", ts)
		os.WriteFile(bakPath, data, 0644)
		return fmt.Sprintf(
			"Refusing to write %s: file on disk has content that wouldn't round-trip through the memory tool (likely modified externally). "+
				"A snapshot was saved to %s. Resolve the drift first — either rewrite the file as a clean §-delimited list, or move the extra content out — then retry.",
			filepath.Base(path), bakPath,
		)
	}
	return ""
}

func (s *MemoryStore) successResult(target, message string, actionInfo *memoryActionInfo) *memoryToolResult {
	entries := s.entriesFor(target)
	current := s.charCount(target)
	limit := s.charLimit(target)

	return &memoryToolResult{
		Success:    true,
		Target:     target,
		Entries:    entries,
		Usage:      s.usageStr(current, limit),
		EntryCount: len(entries),
		Message:    message,
		Action:     actionInfo,
	}
}

func (s *MemoryStore) ReloadFromDisk() {
	s.LoadFromDisk()
}

func dedupe(entries []string) []string {
	seen := make(map[string]bool)
	var out []string
	for _, e := range entries {
		if !seen[e] {
			seen[e] = true
			out = append(out, e)
		}
	}
	return out
}

func memoryToolResultToJSON(r *memoryToolResult) string {
	if r == nil {
		return `{"success":false,"error":"unknown error"}`
	}
	data, _ := json.Marshal(r)
	return string(data)
}

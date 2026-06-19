package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/pmezard/go-difflib/difflib"
	"github.com/zendev-sh/goai"
)

var cwd string

func init() {
	cwd = os.Getenv("CWD")
	if cwd == "" {
		cwd, _ = os.Getwd()
	}
}

func makeWriteTool() goai.Tool {
	return goai.NewTool("write", "Write content to a file. Creates parent directories automatically. Returns the number of bytes written.",
		func(ctx context.Context, in struct {
			Path    string `json:"path" jsonschema:"description=Path to the file to write (relative or absolute)"`
			Content string `json:"content" jsonschema:"description=Content to write to the file"`
		}) (string, error) {
			absPath := resolvePath(in.Path)
			dir := filepath.Dir(absPath)
			if err := os.MkdirAll(dir, 0755); err != nil {
				return "", fmt.Errorf("mkdir: %w", err)
			}
			if err := os.WriteFile(absPath, []byte(in.Content), 0644); err != nil {
				return "", fmt.Errorf("write: %w", err)
			}
			return fmt.Sprintf("Successfully wrote %d bytes to %s", len(in.Content), in.Path), nil
		})
}

type textEdit struct {
	OldText string `json:"oldText"`
	NewText string `json:"newText"`
}

func detectLineEnding(s string) string {
	crlf := strings.Index(s, "\r\n")
	lf := strings.Index(s, "\n")
	if lf == -1 {
		return "\n"
	}
	if crlf == -1 || crlf > lf {
		return "\n"
	}
	return "\r\n"
}

func normalizeToLF(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\r", "\n")
	return s
}

func restoreLineEndings(s, ending string) string {
	if ending == "\r\n" {
		return strings.ReplaceAll(s, "\n", "\r\n")
	}
	return s
}

func stripBOM(s string) (bom string, text string) {
	if strings.HasPrefix(s, "\uFEFF") {
		return "\uFEFF", s[1:]
	}
	return "", s
}

func normalizeForFuzzyMatch(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		switch r {
		case '\u2018', '\u2019', '\u201A', '\u201B':
			b.WriteRune('\'')
		case '\u201C', '\u201D', '\u201E', '\u201F':
			b.WriteRune('"')
		case '\u2010', '\u2011', '\u2012', '\u2013', '\u2014', '\u2015', '\u2212':
			b.WriteRune('-')
		case '\u00A0', '\u2002', '\u2003', '\u2004', '\u2005', '\u2006', '\u2007', '\u2008', '\u2009', '\u200A', '\u202F', '\u205F', '\u3000':
			b.WriteRune(' ')
		default:
			b.WriteRune(r)
		}
	}
	lines := strings.Split(b.String(), "\n")
	for i, line := range lines {
		lines[i] = strings.TrimRight(line, " \t")
	}
	return strings.Join(lines, "\n")
}

func fuzzyFindText(content, oldText string) (found bool, index, matchLength int) {
	idx := strings.Index(content, oldText)
	if idx != -1 {
		return true, idx, len(oldText)
	}
	fuzzyContent := normalizeForFuzzyMatch(content)
	fuzzyOld := normalizeForFuzzyMatch(oldText)
	idx = strings.Index(fuzzyContent, fuzzyOld)
	if idx == -1 {
		return false, 0, 0
	}
	return true, idx, len(fuzzyOld)
}

func fuzzyCount(content, oldText string) int {
	fuzzyContent := normalizeForFuzzyMatch(content)
	fuzzyOld := normalizeForFuzzyMatch(oldText)
	n := 0
	idx := 0
	for {
		i := strings.Index(fuzzyContent[idx:], fuzzyOld)
		if i == -1 {
			break
		}
		n++
		idx += i + len(fuzzyOld)
	}
	return n
}

func makeEditTool() goai.Tool {
	return goai.NewTool("edit", "Edit a file using exact text replacement. Each edit must match a unique, non-overlapping region. Supports multiple edits in one call.",
		func(ctx context.Context, in struct {
			FilePath string     `json:"filePath" jsonschema:"description=Path to the file to edit (relative or absolute)"`
			Edits   []textEdit `json:"edits" jsonschema:"description=One or more targeted replacements"`
		}) (string, error) {
			absPath := resolvePath(in.FilePath)

			raw, err := os.ReadFile(absPath)
			if err != nil {
				return "", fmt.Errorf("read: %w", err)
			}
			rawContent := string(raw)
			bom, content := stripBOM(rawContent)
			originalEnding := detectLineEnding(content)
			normalized := normalizeToLF(content)

			if len(in.Edits) == 0 {
				return "", fmt.Errorf("edits must not be empty")
			}
			for i, edit := range in.Edits {
				if edit.OldText == "" {
					return "", fmt.Errorf("edits[%d].oldText must not be empty in %s", i, in.FilePath)
				}
			}

			type matchedEdit struct {
				editIndex   int
				matchIndex  int
				matchLength int
				newText     string
			}

			var matched []matchedEdit
			for i, edit := range in.Edits {
				oldLF := normalizeToLF(edit.OldText)
				found, idx, matchLen := fuzzyFindText(normalized, oldLF)
				if !found {
					msg := fmt.Sprintf("Could not find the exact text in %s. The old text must match exactly including all whitespace and newlines.", in.FilePath)
					if len(in.Edits) > 1 {
						msg = fmt.Sprintf("Could not find edits[%d] in %s. The oldText must match exactly including all whitespace and newlines.", i, in.FilePath)
					}
					return "", fmt.Errorf(msg)
				}
				n := fuzzyCount(normalized, oldLF)
				if n > 1 {
					msg := fmt.Sprintf("Found %d occurrences of the text in %s. The text must be unique. Please provide more context to make it unique.", n, in.FilePath)
					if len(in.Edits) > 1 {
						msg = fmt.Sprintf("Found %d occurrences of edits[%d] in %s. Each oldText must be unique. Please provide more context to make it unique.", n, i, in.FilePath)
					}
					return "", fmt.Errorf(msg)
				}
				newLF := normalizeToLF(edit.NewText)
				matched = append(matched, matchedEdit{
					editIndex:   i,
					matchIndex:  idx,
					matchLength: matchLen,
					newText:     newLF,
				})
			}

			for i := 0; i < len(matched); i++ {
				for j := i + 1; j < len(matched); j++ {
					if matched[j].matchIndex < matched[i].matchIndex {
						matched[i], matched[j] = matched[j], matched[i]
					}
				}
			}
			for i := 1; i < len(matched); i++ {
				prev := matched[i-1]
				curr := matched[i]
				if prev.matchIndex+prev.matchLength > curr.matchIndex {
					return "", fmt.Errorf("edits[%d] and edits[%d] overlap in %s. Merge them into one edit or target disjoint regions.",
						prev.editIndex, curr.editIndex, in.FilePath)
				}
			}

			newContent := normalized
			for i := len(matched) - 1; i >= 0; i-- {
				e := matched[i]
				newContent = newContent[:e.matchIndex] + e.newText + newContent[e.matchIndex+e.matchLength:]
			}

			if newContent == normalized {
				msg := fmt.Sprintf("No changes made to %s. The replacement produced identical content.", in.FilePath)
				if len(in.Edits) > 1 {
					msg = fmt.Sprintf("No changes made to %s. The replacements produced identical content.", in.FilePath)
				}
				return "", fmt.Errorf(msg)
			}

			final := bom + restoreLineEndings(newContent, originalEnding)
			if err := os.WriteFile(absPath, []byte(final), 0644); err != nil {
				return "", fmt.Errorf("write: %w", err)
			}

			diff := unifiedDiff(normalized, newContent)

			return fmt.Sprintf("Successfully edited %d block(s) in %s.\n\n%s", len(in.Edits), in.FilePath, diff), nil
		})
}

func unifiedDiff(oldText, newText string) string {
	diff := difflib.UnifiedDiff{
		A:       difflib.SplitLines(oldText),
		B:       difflib.SplitLines(newText),
		Context: 3,
	}
	out, err := difflib.GetUnifiedDiffString(diff)
	if err != nil {
		return fmt.Sprintf("(diff generation failed: %v)", err)
	}
	return strings.TrimRight(out, "\n")
}

func makeBashTool() goai.Tool {
	return goai.NewTool("bash", "Execute a bash command on the system. Use for system info, file management, installing packages, running programs. Returns stdout and stderr.",
		func(ctx context.Context, in struct {
			Command string `json:"command" jsonschema:"description=Bash command to execute"`
			Timeout *int   `json:"timeout,omitempty" jsonschema:"description=Timeout in seconds (optional)"`
		}) (string, error) {
			var cancel context.CancelFunc
			if in.Timeout != nil && *in.Timeout > 0 {
				ctx, cancel = context.WithTimeout(ctx, time.Duration(*in.Timeout)*time.Second)
				defer cancel()
			}

			cmd := exec.CommandContext(ctx, "bash", "-c", in.Command)
			cmd.Dir = cwd
			output, err := cmd.CombinedOutput()
			result := string(output)

			const maxBytes = 128 * 1024
			if len(result) > maxBytes {
				result = result[len(result)-maxBytes:]
			}

			if err != nil {
				if ctx.Err() == context.DeadlineExceeded {
					return "", fmt.Errorf("%s\n\nCommand timed out after %d seconds", result, *in.Timeout)
				}
				return "", fmt.Errorf("%s\n\nCommand exited with error: %v", result, err)
			}
			if result == "" {
				result = "(no output)"
			}
			return result, nil
		})
}

func makeWebSearchTool() goai.Tool {
	return goai.NewTool("webSearch", "Search the web for information. Use this to find current information, news, or any data from the internet. Returns formatted search results with titles and snippets.",
		func(ctx context.Context, in struct {
			Query string `json:"query" jsonschema:"description=Search query string"`
		}) (string, error) {
			results, err := searchWeb(ctx, in.Query)
			if err != nil {
				return "", fmt.Errorf("web search failed: %w", err)
			}
			return results, nil
		})
}

func makeMemoryTool(store *MemoryStore, onNudge func(), collector *reviewActionCollector) goai.Tool {
	return goai.NewTool("memory", `Save durable information to persistent memory that survives across sessions. Memory is injected into future turns, so keep it compact and focused on facts that will still matter later.

WHEN TO SAVE (do this proactively, don't wait to be asked):
- User corrects you or says 'remember this' / 'don't do that again'
- User shares a preference, habit, or personal detail (name, role, timezone, coding style)
- You discover something about the environment (OS, installed tools, project structure)
- You learn a convention, API quirk, or workflow specific to this user's setup

TWO TARGETS:
- 'user': who the user is — name, role, preferences, communication style
- 'memory': your notes — environment facts, project conventions, tool quirks, lessons learned

ACTIONS: add (new entry), replace (update existing — old_text identifies it by substring match), remove (delete — old_text identifies it by substring match).`,
		func(ctx context.Context, in struct {
			Action  string `json:"action" jsonschema:"description=The action to perform: add, replace, or remove"`
			Target  string `json:"target" jsonschema:"description=Which store: 'memory' for personal notes, 'user' for user profile"`
			Content string `json:"content,omitempty" jsonschema:"description=Entry content. Required for add and replace."`
			OldText string `json:"old_text,omitempty" jsonschema:"description=Short unique substring identifying the entry to replace or remove. Required for replace and remove."`
		}) (string, error) {
			if in.Target != "memory" && in.Target != "user" {
				return `{"success":false,"error":"Invalid target. Use 'memory' or 'user'."}`, nil
			}
			if !store.IsEnabled(in.Target) {
				return fmt.Sprintf(`{"success":false,"error":"%s is disabled in settings."}`, in.Target), nil
			}
			if in.Action == "add" || in.Action == "replace" {
				if strings.TrimSpace(in.Content) == "" {
					return `{"success":false,"error":"Content cannot be empty."}`, nil
				}
			}
			if in.Action == "replace" || in.Action == "remove" {
				if strings.TrimSpace(in.OldText) == "" {
					return fmt.Sprintf(`{"success":false,"error":"old_text is required for '%s' action."}`, in.Action), nil
				}
			}

			result := store.Dispatch(in.Action, in.Target, in.Content, in.OldText)
			jsonResult := memoryToolResultToJSON(result)

			if result != nil && result.Success && onNudge != nil {
				onNudge()
			}

			if result != nil && result.Success && collector != nil {
				desc := summarizeMemoryAction("memory", jsonResult)
				if desc != "" {
					collector.add(desc)
				}
			}

			return jsonResult, nil
		})
}

func resolvePath(p string) string {
	if filepath.IsAbs(p) {
		return p
	}
	return filepath.Join(cwd, p)
}

type ddgResponse struct {
	AbstractText string `json:"AbstractText"`
	AbstractURL  string `json:"AbstractURL"`
	RelatedTopics []struct {
		Text     string `json:"Text"`
		FirstURL string `json:"FirstURL"`
	} `json:"RelatedTopics"`
}

func searchWeb(ctx context.Context, query string) (string, error) {
	return searchDuckDuckGo(ctx, query)
}

func searchDuckDuckGo(ctx context.Context, query string) (string, error) {
	u := fmt.Sprintf("https://api.duckduckgo.com/?q=%s&format=json&no_html=1", url.QueryEscape(query))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var data struct {
		AbstractText string `json:"AbstractText"`
		AbstractURL  string `json:"AbstractURL"`
		AbstractSource string `json:"AbstractSource"`
		RelatedTopics []any `json:"RelatedTopics"`
		Results       []any `json:"Results"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return "", err
	}

	var parts []string

	if data.AbstractText != "" {
		parts = append(parts, fmt.Sprintf("Abstract: %s\nSource: %s\nURL: %s", data.AbstractText, data.AbstractSource, data.AbstractURL))
	}

	if len(data.Results) > 0 {
		for _, r := range data.Results {
			if m, ok := r.(map[string]any); ok {
				text, _ := m["Text"].(string)
				firstURL, _ := m["FirstURL"].(string)
				if text != "" {
					parts = append(parts, fmt.Sprintf("- %s\n  %s", text, firstURL))
				}
			}
		}
	}

	if len(data.RelatedTopics) > 0 {
		for _, r := range data.RelatedTopics {
			if m, ok := r.(map[string]any); ok {
				if text, ok := m["Text"].(string); ok && text != "" {
					firstURL, _ := m["FirstURL"].(string)
					parts = append(parts, fmt.Sprintf("- %s\n  %s", text, firstURL))
				}
				if topics, ok := m["Topics"]; ok {
					if topicList, ok := topics.([]any); ok {
						for _, t := range topicList {
							if tm, ok := t.(map[string]any); ok {
								text, _ := tm["Text"].(string)
								firstURL, _ := tm["FirstURL"].(string)
								if text != "" {
									parts = append(parts, fmt.Sprintf("- %s\n  %s", text, firstURL))
								}
							}
						}
					}
				}
			}
		}
	}

	if len(parts) == 0 {
		return "No results found.", nil
	}
	return strings.Join(parts, "\n\n"), nil
}



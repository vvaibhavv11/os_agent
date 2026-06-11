# AI Desktop App

An AI agentic desktop assistant powered by [Wails](https://wails.io) v2 — Go backend + React/TypeScript (Vite) frontend.

## Features

- **AI chat** over OpenRouter with any model — streaming text, reasoning/thoughts, and tool calls
- **Tool use** — write files, edit text in files, run bash commands, search the web (DuckDuckGo, no API key needed)
- **Per-conversation scroll memory** — each chat remembers its own scroll position when switching
- **Smart auto-scroll** — only scrolls to bottom on new content if you're already near the bottom
- **Conversation management** — create, rename, delete, switch between multiple chats
- **Auto-title** — conversations are automatically titled from the first user message (truncated to 30 chars)
- **Tool call UI** — expandable tool call cards with status indicators (executing/completed/failed) and results
- **Thought/reasoning display** — loading spinner during reasoning, expandable on completion
- **Error handling** — inline system messages for errors, connection status indicator
- **Stop generation** — cancel ongoing AI responses mid-stream
- **Empty state** — suggestion buttons to quickly start common tasks
- **SQLite storage** (WAL mode) at `~/.ai-chat/conversations.db` with JSON mirrors
- **Typing indicator** — shows when the AI is thinking or waiting
- **Gruvbox dark theme** — warm, eye-friendly dark UI

## Requirements

- Go 1.21+
- Node.js 18+ with pnpm
- `OPENROUTER_API_KEY` set in `~/.ai-chat/.env`, project `.env`, or environment

## Quick Start

```bash
# Live development (HMR frontend + auto-rebuild Go)
wails dev

# Production build
wails build
# Output: build/bin/ai_desktop_app
```

## Architecture

| Layer | Stack |
|-------|-------|
| Backend | Go (`main.go` → `app.go` → `agent.go` + `tools.go` + `storage.go`) |
| Frontend | React 18 + Zustand + Tailwind CSS |
| Storage | SQLite (WAL mode) at `~/.ai-chat/conversations.db` + JSON mirrors |
| AI | OpenRouter streaming via `goai` library |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENROUTER_API_KEY` | — | Required. AI provider API key |
| `AI_PROVIDER` | `openrouter` | AI provider to use |
| `OPENROUTER_MODEL` | `openrouter/owl-alpha` | Model ID for chat |
| `CWD` | `.` | Working directory for tool execution |

## License

MIT

# AI Desktop App

An **agentic AI desktop assistant** powered by [Wails](https://wails.io) v2 — Go backend + React/TypeScript (Vite) frontend. Beyond chat: the AI can **write code, edit files, run commands, and search the web** — all through a native desktop UI.

## Features

### Agentic Tool Use
- **Write & edit files** — AI creates and modifies source code in your project
- **Run bash commands** — execute shell commands, install packages, run builds
- **Web search** — DuckDuckGo instant answers, no API key needed
- **Multi-tool orchestration** — AI chains tool calls to solve complex tasks

### Chat & UX
- **Streaming responses** — real-time text, reasoning/thoughts, and tool calls from any OpenRouter model
- **Thought/reasoning display** — loading spinner during reasoning, expandable on completion
- **Tool call cards** — expandable UI with status indicators (executing/completed/failed) and results
- **Smart auto-scroll** — follows new content only when you're near the bottom
- **Per-conversation scroll memory** — remembers scroll position when switching chats
- **Stop mid-generation** — cancel ongoing AI responses
- **Empty state suggestions** — quick-start buttons for common tasks
- **Typing indicator** — shows when the AI is thinking
- **Conversation management** — create, rename, delete, switch between chats; auto-titled from first message

### Under the Hood
- **Automatic context-length detection** — resolves from [models.dev](https://models.dev) (primary) or `/v1/models` endpoint (fallback), covering **25+ providers** (OpenAI, Anthropic, DeepSeek, Gemini, Groq, Mistral, Together, Perplexity, Cohere, Fireworks, HuggingFace, xAI, NVIDIA, and more). No manual configuration or hardcoded defaults.
- **Local caching** — models.dev registry cached to `~/.ai-chat/models.json` with background refresh (every 60 min); no redundant API calls
- **Persistent storage** — SQLite (WAL mode) at `~/.ai-chat/conversations.db` with JSON mirrors
- **Model-agnostic** — use any model from OpenRouter, OpenAI, Anthropic, or any provider serving a `/v1/chat/completions` compatible API
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

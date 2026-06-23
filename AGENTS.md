# AI Desktop App

Wails v2 desktop app — Go backend + React/TypeScript (Vite) frontend. An AI agentic desktop assistant with tool use (write, edit, bash, webSearch, memory).

## Dev Commands
- `wails dev` — live development (Vite HMR + Go backend, auto-rebuilds on Go changes)
- `wails build` — production build (compiles Go + bundles frontend/dist)
- From `frontend/`: `pnpm dev` (Vite only), `pnpm build` (= `tsc && vite build`)

## Required Env
Set `OPENROUTER_API_KEY` in `~/.ai-chat/.env`, project `.env`, or system env.
Optional: `AI_PROVIDER` (default: openrouter), `OPENROUTER_MODEL` (default: openrouter/owl-alpha), `CWD`.

## Architecture

### Backend (Go — single `main` package, all source in repo root)
Uses `goai` library for AI streaming and tool orchestration.

| File | Purpose |
|------|---------|
| `main.go` | Entry point, Wails app bootstrap |
| `app.go` | Core `App` struct, Wails lifecycle hooks, bound methods for frontend |
| `agent.go` | AI agent loop — streaming, tool orchestration, message handling |
| `tools.go` | Agent tool definitions (write, edit, bash, webSearch, memory) |
| `types.go` | Shared Go types (`Conversation`, etc.) |
| `storage.go` | SQLite persistence + JSON mirrors for conversations |
| `settings.go` | Settings management with encrypted API key storage (AES) |
| `models_dev.go` | Model/provider configuration and discovery |
| `memory_store.go` | `MemoryStore` struct — frozen snapshot, CRUD `Dispatch()`, `§`-delimited entries, atomic writes |
| `memory_review.go` | Background goroutine after each turn — LLM call with `memory` tool to evaluate and persist learnings |

### Frontend (`frontend/src/` — React 18 + TypeScript + Vite)

**Components** (`components/`):

| File | Purpose |
|------|---------|
| `ChatArea.tsx` | Main chat view — message list, scroll management, tool/thinking grouping |
| `MessageBubble.tsx` | User/assistant message bubbles with copy button |
| `ThinkingBlock.tsx` | Collapsible thinking/reasoning display |
| `ToolCall.tsx` | Compact tool call row with icon + label, expandable details |
| `ToolCallDetails.tsx` | Expanded view of tool call args and results |
| `InputBar.tsx` | Chat input with send/stop controls |
| `Sidebar.tsx` | Conversation list, new chat, navigation |
| `SettingsPage.tsx` | Full settings UI (providers, models, memory, etc.) |
| `ModelSelector.tsx` | Model/provider picker dropdown |
| `ContextMeter.tsx` | Token/context usage visualization |
| `MarkdownText.tsx` | Markdown renderer for message content |
| `TypingIndicator.tsx` | Animated dots while waiting for response |

**Stores** (`stores/` — Zustand):

| File | Purpose |
|------|---------|
| `chatStore.ts` | Conversations, stream items, active chat state |
| `modelSelectorStore.ts` | Selected model/provider, provider list |
| `settingsStore.ts` | App settings state |

**Hooks** (`hooks/`):

| File | Purpose |
|------|---------|
| `useChat.ts` | Wails runtime event listeners (`text_delta`, `tool_call`, `tool_result`, `memory_review`, etc.) |

**Utils & Lib**:

| File | Purpose |
|------|---------|
| `utils/toolCallIcons.ts` | Tool name → icon path + label resolution |
| `lib/utils.ts` | General utilities (e.g. `formatTitle`) |

### Storage
- SQLite at `~/.ai-chat/conversations.db` + JSON mirrors at `~/.ai-chat/conversations/`. WAL journal mode.

### Memory
- File-based at `~/.ai-chat/memories/MEMORY.md` + `USER.md`.
- `§`-delimited entries. Frozen snapshot pattern — injected into system prompt at session start, stays stable to preserve LLM prefix cache.
- CRUD via `memory` tool. Background review goroutine after each turn.
- Settings: `Settings.MemoryEnabled`, `Settings.UserProfileEnabled`, `Settings.MemoryCharLimit`, `Settings.UserCharLimit`, `Settings.NudgeInterval`.

## Key Conventions
- When adding new Go methods bound to frontend, run `wails generate module` to regenerate `frontend/wailsjs/` bindings.
- Conversations auto-title from first user message (truncated to 30 chars).
- No tests, no CI, no linter config — lint/typecheck/build before committing.
- Frontend state is driven by Wails runtime events — see `hooks/useChat.ts`.
- **Always run `wails build` after making changes** to produce the production binary at `build/bin/ai_desktop_app`. No need to run `pnpm build` separately — `wails build` compiles the frontend automatically.
- Consecutive thinking blocks and tool calls are grouped into compact blocks in `ChatArea.tsx` — empty assistant messages are absorbed into the group to avoid visual splitting.

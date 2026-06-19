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
- **Backend** (`main.go` → `app.go` → `agent.go` + `tools.go` + `storage.go` + `memory_store.go` + `memory_review.go`): One `main` package, all Go source in repo root. Uses `goai` library for AI streaming and tool orchestration.
- **Frontend** (`frontend/src/`): React 18 + Zustand (chatStore), Wails runtime events for streaming. Components in `components/`, hooks in `hooks/`.
- **Storage**: SQLite at `~/.ai-chat/conversations.db` + JSON mirrors at `~/.ai-chat/conversations/`. WAL journal mode.
- **Memory**: File-based at `~/.ai-chat/memories/MEMORY.md` + `USER.md`. `§`-delimited entries. Frozen snapshot pattern — injected into system prompt at session start, stays stable to preserve LLM prefix cache. CRUD via `memory` tool. Background review goroutine after each turn.
- **Agent tools**: write (file), edit (text replacement), bash, webSearch (DuckDuckGo instant answer), memory (persistent file-based memory).

## Key Conventions
- When adding new Go methods bound to frontend, run `wails generate module` to regenerate `frontend/wailsjs/` bindings.
- Conversations auto-title from first user message (truncated to 30 chars).
- No tests, no CI, no linter config — lint/typecheck/build before committing.
- Frontend state is driven by Wails runtime events (`text_delta`, `tool_call`, `tool_result`, `memory_review`, etc.) — see `hooks/useChat.ts`.
- **Always run `wails build` after making changes** to produce the production binary at `build/bin/ai_desktop_app`. No need to run `pnpm build` separately — `wails build` compiles the frontend automatically.
- **Memory system**: `memory_store.go` has the core `MemoryStore` struct (frozen snapshot at `LoadFromDisk()`, CRUD `Dispatch()` methods, `\n§\n` delimiter, atomic writes via temp file + rename, external drift detection). `memory_review.go` spawns a background goroutine after each turn that runs an LLM call with only the `memory` tool to evaluate and persist learnings. Settings in `Settings.MemoryEnabled`, `Settings.UserProfileEnabled`, `Settings.MemoryCharLimit`, `Settings.UserCharLimit`, `Settings.NudgeInterval`.

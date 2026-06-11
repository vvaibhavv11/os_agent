# AI Desktop App

Wails v2 desktop app — Go backend + React/TypeScript (Vite) frontend. An AI agentic desktop assistant with tool use (write, edit, bash, webSearch).

## Dev Commands
- `wails dev` — live development (Vite HMR + Go backend, auto-rebuilds on Go changes)
- `wails build` — production build (compiles Go + bundles frontend/dist)
- From `frontend/`: `pnpm dev` (Vite only), `pnpm build` (= `tsc && vite build`)

## Required Env
Set `OPENROUTER_API_KEY` in `~/.ai-chat/.env`, project `.env`, or system env.
Optional: `AI_PROVIDER` (default: openrouter), `OPENROUTER_MODEL` (default: openrouter/owl-alpha), `CWD`.

## Architecture
- **Backend** (`main.go` → `app.go` → `agent.go` + `tools.go` + `storage.go`): One `main` package, all Go source in repo root. Uses `goai` library for AI streaming and tool orchestration.
- **Frontend** (`frontend/src/`): React 18 + Zustand (chatStore), Wails runtime events for streaming. Components in `components/`, hooks in `hooks/`.
- **Storage**: SQLite at `~/.ai-chat/conversations.db` + JSON mirrors at `~/.ai-chat/conversations/`. WAL journal mode.
- **Agent tools**: write (file), edit (text replacement), bash, webSearch (DuckDuckGo instant answer, no API key needed).

## Key Conventions
- When adding new Go methods bound to frontend, run `wails generate module` to regenerate `frontend/wailsjs/` bindings.
- Conversations auto-title from first user message (truncated to 30 chars).
- No tests, no CI, no linter config — lint/typecheck/build before committing.
- Frontend state is driven by Wails runtime events (`text_delta`, `tool_call`, `tool_result`, etc.) — see `hooks/useChat.ts`.
- **Always run `wails build` after making changes** to produce the production binary at `build/bin/ai_desktop_app`. No need to run `pnpm build` separately — `wails build` compiles the frontend automatically.

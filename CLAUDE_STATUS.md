# Project Status & Context

> For AI assistants and developers picking up this project cold.

## Project Overview

**Note Taker Plus** is a spaced repetition learning system. The user learns best in classroom settings with repetition and practice. This app captures knowledge from various sources and turns it into flashcards for long-term retention.

**Core workflow:**
1. Capture highlights/facts from reading (Raindrop.io, Chrome extension, manual entry)
2. Generate flashcards from those highlights (using local LLM via Ollama)
3. Review and quiz using spaced repetition (SM-2 algorithm, same as Anki)

## Key Decisions Made

| Decision | Rationale |
|----------|-----------|
| **PostgreSQL over SQLite** | Multi-device sync requires cloud DB; SQLite doesn't sync well |
| **Railway for hosting** | Easy PaaS, generous free tier, auto-deploy from GitHub |
| **Raindrop.io over Readwise** | User already uses it, good free tier, supports highlight colors (orange = flashcard) |
| **Local LLM (Ollama) for card generation** | Privacy-first, no API costs, user wanted to learn Ollama |
| **React + TypeScript for frontend** | User wants to improve TS skills |
| **FastAPI + SQLAlchemy async** | Python backend user can maintain, modern async stack |
| **PWA over native iOS app** | Avoids App Store, works on iPhone via Safari |
| **Textual TUI planned but deferred** | Start with web UI, add terminal UI later if wanted |
| **API key auth (simple)** | Single-user app, no need for full auth system |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        INPUT SOURCES                             │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│ Chrome Ext   │ Raindrop.io  │ Web UI       │ (Future: Alfred,  │
│ (highlight)  │ (orange=card)│ (manual)     │  iOS Shortcuts)   │
└──────┬───────┴──────┬───────┴──────┬───────┴───────────────────┘
       │              │              │
       ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│              FASTAPI BACKEND (Railway)                           │
│  • REST API for CRUD                                             │
│  • Spaced repetition (SM-2)                                      │
│  • Raindrop sync endpoint                                        │
│  • Card generation via Ollama                                    │
└───────────────────────┬─────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  PostgreSQL   │ │ Ollama (local)│ │ Obsidian      │
│  (Railway)    │ │ on user's Mac │ │ export (MD)   │
└───────────────┘ └───────────────┘ └───────────────┘
```

## What's Implemented ✅

### Backend (FastAPI)
- [x] Source model (original highlights/facts) with CRUD
- [x] Card model (flashcards) with CRUD
- [x] Tag model with many-to-many relationships
- [x] Spaced repetition service (SM-2 algorithm)
- [x] Raindrop.io sync service (fetches highlights, orange = flashcard)
- [x] Ollama integration for card generation
- [x] Obsidian export service (markdown files)
- [x] Simple API key authentication
- [x] Health check endpoints
- [x] CORS configuration via env var

### Frontend (React + TypeScript)
- [x] Cards page with list, filter, edit, delete
- [x] Cards page: Create Card button and modal (just added)
- [x] Sources page with list, filter, edit, delete
- [x] Quiz page with keyboard shortcuts (Space=reveal, 1-4=rate)
- [x] Review page for pending sources
- [x] Settings page (API key input, service status)
- [x] PWA configuration (works on mobile Safari)
- [x] TailwindCSS styling (dark theme)

### Chrome Extension
- [x] Manifest V3
- [x] Context menu "Save to Note Taker+"
- [x] Keyboard shortcut (Ctrl+Shift+S)
- [x] Popup for API URL/key configuration
- [x] Toast notifications

### Deployment
- [x] Railway deployment configs
- [x] Backend deployed and working
- [x] Frontend deployed and working
- [x] PostgreSQL on Railway
- [x] Serverless/auto-sleep configured (cost saving)

## What's NOT Implemented Yet ❌

### High Priority
- [ ] Cloud LLM option (OpenAI/Anthropic) for card generation when not on Mac
- [ ] Raindrop token in Railway backend (user hasn't added it yet)
- [ ] Test the full Raindrop → Source → Card flow

### Medium Priority (User's "Future Work")
- [ ] Obsidian as INPUT source (read .md files → create cards)
- [ ] Obsidian Web Clipper integration
- [ ] Alfred workflow for quick capture
- [ ] iOS Shortcuts for voice/text capture
- [ ] Textual TUI for terminal-based quizzing

### Low Priority / Nice to Have
- [ ] Auto-set API key via VITE_API_KEY env var (discussed, not implemented)
- [ ] Sync button in UI for Raindrop
- [ ] Progress/stats dashboard
- [ ] PWA icons (currently placeholder)

## Current Deployment URLs

- **Frontend**: `https://frontend-production-4104.up.railway.app` (or similar)
- **Backend**: `https://note-taker-plus-production.up.railway.app` (or similar)
- **API Docs**: `{backend-url}/docs`

## Environment Variables

### Backend (Railway)
```
DATABASE_URL=postgresql+asyncpg://...  # From Railway Postgres, change postgres:// to postgresql+asyncpg://
API_KEY=<secret>
CORS_ORIGINS=https://frontend-url.up.railway.app,http://localhost:5173
RAINDROP_TOKEN=<optional, from raindrop.io/settings/integrations>
OLLAMA_BASE_URL=http://localhost:11434  # Won't work in cloud
OLLAMA_MODEL=llama3.2
```

### Frontend (Railway)
```
VITE_API_URL=https://backend-url.up.railway.app  # No trailing slash!
```

## Known Issues / Gotchas

1. **DATABASE_URL format**: Railway gives `postgres://...`, but SQLAlchemy async needs `postgresql+asyncpg://...`

2. **Ollama only works locally**: Card generation requires Ollama on user's Mac. Cloud deployment can CRUD cards but not auto-generate them.

3. **Lazy loading in async SQLAlchemy**: Relationships (like `card.tags`) must be eagerly loaded with `selectinload()` before serializing to Pydantic, or you get `MissingGreenlet` errors.

4. **Vite preview host**: Railway needs `preview.allowedHosts` in vite.config.ts to include `.railway.app`.

5. **Railpack detection**: Needs `main.py` in backend root that imports from `app.main` for auto-detection.

## File Structure (Key Files)

```
backend/
├── main.py                    # Wrapper for Railpack (imports app.main)
├── pyproject.toml             # Dependencies (not requirements.txt)
├── app/
│   ├── main.py                # FastAPI app, CORS, routers
│   ├── config.py              # Pydantic settings
│   ├── database.py            # Async SQLAlchemy engine
│   ├── auth.py                # API key verification
│   ├── models/                # SQLAlchemy models
│   ├── routers/               # API endpoints
│   ├── schemas/               # Pydantic schemas
│   └── services/              # Business logic (spaced rep, raindrop, ollama)

frontend/
├── src/
│   ├── App.tsx                # Router setup
│   ├── pages/                 # CardsPage, QuizPage, etc.
│   ├── services/api.ts        # API client
│   ├── hooks/useStore.ts      # Zustand store
│   └── vite-env.d.ts          # TypeScript env types

extension/
├── manifest.json              # Chrome extension config
├── src/
│   ├── background.js          # Service worker
│   ├── content.js             # Page script
│   └── popup.html/js          # Extension popup
```

## Git Branch Strategy

- `main` - Production, Railway deploys from here
- `claude/*-vI7R2` - Claude Code session branches, merge to main when ready

## User Preferences (for AI context)

- Prefers Python backends, wants to learn TypeScript
- Learns best with spaced repetition and practice
- Uses Raindrop.io for reading/highlights
- Has Obsidian vault at `/Users/scotthalgrim/Documents/Obsidian/main`
- Wants to understand WHY, not just have code written
- Gets frustrated with slow responses (be concise!)

# Note Taker Plus

A spaced repetition learning system with multiple input sources. Capture knowledge from anywhere and turn it into flashcards for effective long-term retention.

## Features

- **Multiple Input Sources**
  - Raindrop.io integration (orange highlights → flashcards)
  - Chrome extension for quick capture
  - Manual entry via web UI
  - (Planned) Alfred workflow, iOS Shortcuts

- **AI-Powered Card Generation**
  - Local LLM via Ollama (privacy-first, no cloud dependency)
  - Automatic flashcard creation from highlights
  - Smart tagging suggestions

- **Spaced Repetition**
  - SM-2 algorithm (same as Anki)
  - Quiz mode with keyboard shortcuts
  - Progress tracking and statistics

- **Obsidian Integration**
  - Export learnings to markdown
  - Searchable knowledge base
  - Git-friendly format

- **Cross-Device Access**
  - Web UI (PWA - works on mobile)
  - Cloud-synced PostgreSQL backend

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL (or use Docker)
- Ollama (for local LLM)

### 1. Clone and Setup Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -e .

# Copy and configure environment
cp .env.example .env
# Edit .env with your settings
```

### 2. Start PostgreSQL

Using Docker:
```bash
docker run -d --name notetaker-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=notetaker \
  -p 5432:5432 \
  postgres:15
```

Or use your existing PostgreSQL installation.

### 3. Setup Ollama

```bash
# Install Ollama (macOS)
brew install ollama

# Start Ollama service
ollama serve

# Pull a model (in another terminal)
ollama pull llama3.2
```

### 4. Start Backend

```bash
cd backend
uvicorn app.main:app --reload
```

The API will be available at http://localhost:8000. Check http://localhost:8000/docs for API documentation.

### 5. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

The web UI will be available at http://localhost:5173.

### 6. Configure the App

1. Open http://localhost:5173
2. Go to Settings
3. Enter your API key (from `backend/.env`)
4. Verify Ollama and Raindrop connections

## Configuration

### Environment Variables (backend/.env)

```bash
# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/notetaker

# API Key (generate a random string)
API_KEY=your-secret-api-key-here

# CORS allowed origins (comma-separated, add your frontend URL for production)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173

# Raindrop.io (get from https://app.raindrop.io/settings/integrations)
RAINDROP_TOKEN=your-raindrop-token

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Obsidian (optional)
OBSIDIAN_VAULT_PATH=/Users/yourname/Documents/Obsidian/main
OBSIDIAN_LEARNINGS_FOLDER=learnings
```

### Raindrop.io Setup

1. Go to [Raindrop.io Settings → Integrations](https://app.raindrop.io/settings/integrations)
2. Create a new app or use "Test Token"
3. Copy the token to your `.env` file
4. Use **orange highlights** in Raindrop to mark content for flashcard generation

### Chrome Extension

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension` folder
5. Click the extension icon to configure API URL and key

**Usage:**
- Select text on any webpage
- Right-click → "Save to Note Taker+"
- Or use `Ctrl+Shift+S` (Cmd+Shift+S on Mac)

## Usage Workflow

### 1. Capture Knowledge

- **Reading articles**: Use Raindrop.io with orange highlights
- **Browsing**: Use Chrome extension to capture selections
- **Manual**: Add sources directly in the web UI

### 2. Review Queue

- Sources appear in the Review Queue
- Click "Generate Cards" to create flashcards using Ollama
- Review and edit the generated cards
- Click "Approve & Activate" to add cards to your study rotation

### 3. Quiz Mode

- Due cards appear in Quiz mode
- Rate your recall: Again (1), Hard (2), Good (3), Easy (4)
- Cards are scheduled using spaced repetition
- Keyboard shortcuts: Space to reveal, 1-4 to rate

### 4. Export to Obsidian

- Configure your vault path in `.env`
- Use the API endpoint `POST /export/obsidian` or add a button in settings
- Learnings are exported as linked markdown files

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /sources` | List all sources |
| `POST /sources` | Create a source |
| `POST /sources/{id}/generate-cards` | Generate flashcards |
| `POST /sources/{id}/approve` | Approve and activate cards |
| `GET /cards` | List all cards |
| `GET /cards/due` | Get cards due for review |
| `POST /cards/{id}/review` | Submit a review |
| `POST /sync/raindrop` | Sync Raindrop highlights |
| `POST /export/obsidian` | Export to Obsidian vault |

See full API docs at http://localhost:8000/docs

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions on deploying to Railway or Render.

**Quick overview:**
1. Create a new project on Railway
2. Add a PostgreSQL database
3. Deploy the `backend` folder (Railpack auto-detects FastAPI via `pyproject.toml`)
4. Set environment variables (DATABASE_URL, API_KEY, CORS_ORIGINS)
5. Deploy the `frontend` folder with `VITE_API_URL` pointing to your backend

**Note:** Card generation requires Ollama, which runs locally. Capture sources from anywhere, generate cards on your Mac, quiz from anywhere.

## Project Structure

```
note-taker-plus/
├── backend/
│   ├── main.py          # Entry point (wrapper for Railpack)
│   ├── pyproject.toml   # Dependencies and build config
│   ├── app/
│   │   ├── models/      # SQLAlchemy models
│   │   ├── routers/     # API endpoints
│   │   ├── schemas/     # Pydantic schemas
│   │   ├── services/    # Business logic
│   │   └── main.py      # FastAPI app
│   └── alembic/         # Database migrations
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom hooks
│   │   ├── services/    # API client
│   │   └── types/       # TypeScript types
│   └── public/          # Static assets
└── extension/
    └── src/             # Chrome extension
```

## Tech Stack

- **Backend**: Python, FastAPI, SQLAlchemy, PostgreSQL
- **Frontend**: React, TypeScript, TailwindCSS, Vite
- **LLM**: Ollama (local)
- **Extension**: Chrome Manifest V3

## Contributing

This is a personal learning project, but suggestions are welcome!

## License

MIT

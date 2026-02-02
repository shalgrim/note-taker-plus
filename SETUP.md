# Detailed Setup Guide

This guide walks you through setting up Note Taker Plus on macOS. Linux/Windows instructions are similar with minor adjustments noted.

## Prerequisites

Before starting, ensure you have:

- **Python 3.11+** (3.12 or 3.13 recommended; 3.14 works but is bleeding edge)
- **Node.js 18+** (20 LTS recommended)
- **Docker** (recommended for PostgreSQL) or PostgreSQL installed locally
- **Git**

### Check Your Versions

```bash
python3 --version   # Should be 3.11+
node --version      # Should be 18+
docker --version    # Optional but recommended
```

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/shalgrim/note-taker-plus.git
cd note-taker-plus
```

---

## Step 2: Backend Setup

### 2.1 Create Virtual Environment

```bash
cd backend

# Create venv
python3 -m venv .venv

# Activate it
source .venv/bin/activate  # macOS/Linux
# .venv\Scripts\activate   # Windows
```

### 2.2 Install Dependencies

```bash
pip install --upgrade pip
pip install -e .
```

**Troubleshooting:**

- If you get hatchling errors, ensure your `pyproject.toml` has the `[tool.hatch.build.targets.wheel]` section with `packages = ["app"]`
- On Python 3.14, some packages may have compatibility warnings (they usually still work)

### 2.3 Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```bash
# Required: Database connection
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/notetaker

# Required: API key for authentication (make up a random string)
# Generate one with: python -c "import secrets; print(secrets.token_urlsafe(32))"
API_KEY=your-secret-key-here

# Optional: Raindrop.io integration
RAINDROP_TOKEN=

# Optional: Ollama settings (defaults work if Ollama is running locally)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Optional: Obsidian export
OBSIDIAN_VAULT_PATH=/Users/scotthalgrim/Documents/Obsidian/main
OBSIDIAN_LEARNINGS_FOLDER=learnings
```

---

## Step 3: PostgreSQL Setup

### Option A: Docker (Recommended)

```bash
# Start PostgreSQL container
docker run -d \
  --name notetaker-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=notetaker \
  -p 5432:5432 \
  -v notetaker-pgdata:/var/lib/postgresql/data \
  postgres:15

# Verify it's running
docker ps
```

The `-v notetaker-pgdata:/var/lib/postgresql/data` creates a persistent volume so your data survives container restarts.

**Useful Docker commands:**

```bash
docker stop notetaker-db    # Stop the container
docker start notetaker-db   # Start it again
docker logs notetaker-db    # View logs
docker rm notetaker-db      # Remove container (data in volume persists)
```

### Option B: Local PostgreSQL (macOS)

```bash
# Install via Homebrew
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb notetaker
```

### Option C: Local PostgreSQL (Linux)

```bash
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Create database and user
sudo -u postgres createdb notetaker
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
```

---

## Step 4: Ollama Setup (Local LLM)

Ollama runs AI models locally on your Mac for flashcard generation.

### 4.1 Install Ollama

**macOS:**
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**
Download from https://ollama.com/download

### 4.2 Start Ollama

```bash
# Start the Ollama service (runs in foreground)
ollama serve
```

Keep this terminal open, or run it in the background:
```bash
# Run in background (macOS/Linux)
nohup ollama serve > /dev/null 2>&1 &
```

### 4.3 Pull a Model

In a new terminal:

```bash
# Recommended: Good balance of quality and speed
ollama pull llama3.2

# Alternative: Smaller/faster
ollama pull llama3.2:1b

# Alternative: Larger/smarter (needs more RAM)
ollama pull llama3.2:8b
```

**Model Requirements:**

| Model | RAM Needed | Quality | Speed |
|-------|------------|---------|-------|
| llama3.2:1b | 4GB | Good | Fast |
| llama3.2 (3b) | 6GB | Better | Medium |
| llama3.2:8b | 10GB | Best | Slower |

### 4.4 Test Ollama

```bash
ollama run llama3.2 "Say hello in one word"
```

If this works, Ollama is ready.

---

## Step 5: Start the Backend

```bash
cd backend
source .venv/bin/activate  # If not already activated

# Start with auto-reload for development
uvicorn app.main:app --reload
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
```

**Verify it works:**

- Open http://localhost:8000 - should show `{"name": "Note Taker Plus API", ...}`
- Open http://localhost:8000/docs - interactive API documentation
- Open http://localhost:8000/health - should show service status

**Troubleshooting:**

- **Port in use:** Add `--port 8001` to use a different port
- **Database connection failed:** Check PostgreSQL is running and `.env` is correct
- **Module not found:** Make sure you ran `pip install -e .` and venv is activated

---

## Step 6: Frontend Setup

In a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

Open http://localhost:5173 in your browser.

---

## Step 7: Configure the App

1. Open http://localhost:5173
2. Click **Settings** in the sidebar
3. Enter your API key (the one you put in `backend/.env`)
4. Verify the service status shows green checkmarks for Ollama

---

## Step 8: Get Raindrop.io Token (Optional)

To sync highlights from Raindrop.io:

1. Go to https://app.raindrop.io/settings/integrations
2. Scroll to "For Developers"
3. Click "Create new app"
4. Fill in any name (e.g., "Note Taker Plus")
5. After creating, click on your app
6. Under "Test token", click "Create test token"
7. Copy the token and add it to `backend/.env`:
   ```
   RAINDROP_TOKEN=your-token-here
   ```
8. Restart the backend (`Ctrl+C` and run `uvicorn` again)

---

## Step 9: Install Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Navigate to and select the `extension` folder in this repo
5. Click the puzzle piece icon in Chrome toolbar
6. Pin "Note Taker Plus" for easy access
7. Click the extension icon and configure:
   - API URL: `http://localhost:8000`
   - API Key: (same key from `.env`)

**Usage:**
- Select text on any webpage
- Right-click → "Save to Note Taker+"
- Or press `Ctrl+Shift+S` (Mac: `Cmd+Shift+S`)

---

## Daily Usage

Once everything is set up, your daily workflow is:

### Starting Up

```bash
# Terminal 1: Start Postgres (if using Docker)
docker start notetaker-db

# Terminal 2: Start Ollama
ollama serve

# Terminal 3: Start Backend
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload

# Terminal 4: Start Frontend
cd frontend && npm run dev
```

Or create a startup script - see `scripts/` folder (coming soon).

### Studying

1. Open http://localhost:5173
2. Check **Review** page for new sources to process
3. Click **Quiz** to study due cards
4. Use keyboard shortcuts: Space (reveal), 1-4 (rate)

---

## Troubleshooting

### "Connection refused" on API calls
- Check backend is running on port 8000
- Check you entered the correct API URL in settings
- Check CORS is configured (it should be by default)

### "Invalid API key"
- Make sure the key in the frontend settings matches `API_KEY` in `backend/.env`
- Restart the backend after changing `.env`

### Ollama "connection failed"
- Make sure `ollama serve` is running
- Check http://localhost:11434 is accessible
- Try `ollama run llama3.2 "test"` to verify

### Cards not generating
- Check Ollama service status in Settings
- Check the backend logs for errors
- Ensure you have a model pulled (`ollama list`)

### Database errors
- Check PostgreSQL is running: `docker ps` or `pg_isready`
- Verify DATABASE_URL in `.env` is correct
- Check the database exists: `psql -l`

---

## Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for Railway/Render deployment instructions (coming soon).

---

## Getting Help

- Check the [README.md](README.md) for feature overview
- API documentation at http://localhost:8000/docs
- Open an issue on GitHub for bugs

# Deployment Guide

This guide walks you through deploying Note Taker Plus to Railway (recommended) or other platforms.

## Railway Deployment (Recommended)

Railway offers a generous free tier and easy PostgreSQL setup.

### Prerequisites

1. A [Railway account](https://railway.app/) (sign up with GitHub)
2. Your repo pushed to GitHub

### Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app/) and click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose `shalgrim/note-taker-plus`
4. Railway will ask which folder - we'll set this up manually

### Step 2: Add PostgreSQL Database

1. In your Railway project, click "New" → "Database" → "PostgreSQL"
2. Wait for it to provision
3. Click on the database, go to "Variables" tab
4. Copy the `DATABASE_URL` value (you'll need this)

### Step 3: Deploy Backend

1. In Railway, click "New" → "GitHub Repo" → select your repo
2. In the service settings:
   - **Root Directory**: `backend`
   - **Build Command**: (leave empty, nixpacks auto-detects)
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

3. Go to "Variables" tab and add:
   ```
   DATABASE_URL=<paste from PostgreSQL service>
   API_KEY=<generate a secure random string>
   CORS_ORIGINS=https://your-frontend.up.railway.app,http://localhost:5173
   RAINDROP_TOKEN=<your raindrop token, if using>
   OLLAMA_BASE_URL=<leave empty or set to cloud Ollama if you have one>
   ```

   Generate a secure API key:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

4. Go to "Settings" → "Networking" → "Generate Domain"
5. Note your backend URL (e.g., `https://note-taker-plus-backend.up.railway.app`)

### Step 4: Deploy Frontend

1. In Railway, click "New" → "GitHub Repo" → select your repo again
2. In the service settings:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run preview -- --host 0.0.0.0 --port $PORT`

3. Go to "Variables" tab and add:
   ```
   VITE_API_URL=https://your-backend.up.railway.app
   ```
   (Use the backend URL from Step 3)

4. Go to "Settings" → "Networking" → "Generate Domain"
5. Note your frontend URL

### Step 5: Update Backend CORS

Go back to your backend service and update the `CORS_ORIGINS` variable to include your actual frontend URL:
```
CORS_ORIGINS=https://your-frontend.up.railway.app,http://localhost:5173
```

### Step 6: Test It

1. Open your frontend URL
2. Go to Settings, enter your API key
3. Create a test source and generate cards!

---

## Environment Variables Reference

### Backend

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `API_KEY` | Yes | Your secret API key for authentication |
| `CORS_ORIGINS` | Yes | Comma-separated allowed origins |
| `RAINDROP_TOKEN` | No | Raindrop.io API token |
| `OLLAMA_BASE_URL` | No | Ollama server URL (for card generation) |
| `OLLAMA_MODEL` | No | Model name (default: llama3.2) |
| `OBSIDIAN_VAULT_PATH` | No | Path to Obsidian vault (not used in cloud) |

### Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Backend API URL |

---

## Alternative: Vercel (Frontend) + Railway (Backend)

Vercel is excellent for frontend hosting:

1. Deploy backend to Railway (Steps 1-3 above)
2. Go to [vercel.com](https://vercel.com) and import your repo
3. Set root directory to `frontend`
4. Add environment variable: `VITE_API_URL=https://your-backend.up.railway.app`
5. Deploy

---

## Local LLM Consideration

**Important**: Ollama (local LLM) won't work in cloud deployment since it runs on your Mac. Options:

1. **Generate cards locally first**: Use the local setup to generate cards, then they sync to cloud
2. **Skip auto-generation**: Manually create cards in the cloud UI
3. **Use a cloud LLM API**: Modify the card generator to use OpenAI/Anthropic API instead of Ollama (future enhancement)

For now, the recommended workflow is:
- Capture sources from anywhere (Chrome extension, Raindrop sync)
- Generate cards when you're on your Mac (local Ollama)
- Quiz yourself from anywhere (phone, laptop)

---

## Updating Your Deployment

Railway auto-deploys when you push to your main branch. To deploy:

```bash
git push origin main
```

---

## Troubleshooting

### "CORS error" in browser console
- Check `CORS_ORIGINS` includes your frontend URL exactly
- Make sure there's no trailing slash

### "Invalid API key"
- Verify the API key in frontend Settings matches `API_KEY` env var in backend

### Database connection errors
- Check `DATABASE_URL` is correct
- Railway's PostgreSQL URL format: `postgresql://user:pass@host:port/dbname`
- Our app needs `postgresql+asyncpg://` prefix - Railway might give you `postgres://`
- Replace `postgres://` with `postgresql+asyncpg://`

### Build failures
- Check the build logs in Railway
- Make sure `backend/` and `frontend/` directories exist
- Verify `pyproject.toml` and `package.json` are valid

---

## Cost Estimate

Railway free tier includes:
- $5 of usage per month
- 500MB PostgreSQL storage
- Enough for personal use

Typical usage for this app: ~$0-2/month (well within free tier)

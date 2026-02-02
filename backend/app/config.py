from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/notetaker"

    # API Key for authentication (simple auth for single user)
    api_key: str = "change-me-in-production"

    # CORS origins (comma-separated for production)
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173"

    # Raindrop.io integration
    raindrop_token: str = ""
    raindrop_poll_interval_seconds: int = 300  # 5 minutes

    # Ollama (local LLM)
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"  # Good balance of speed and quality

    # Obsidian export
    obsidian_vault_path: str = ""
    obsidian_learnings_folder: str = "learnings"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "Ambient AI Scribe"
    VERSION: str = "2.0.0"
    
    # Security
    SECRET_KEY: str = "y-r_super_secret_key_change_in_prod"
    ENCRYPTION_KEY: str = "c2VjcmV0LWtleS1tdXN0LWJlLTMyLWJ5dGVzLWxvbmctISEh"
    
    # Infrastructure
    MONGO_URL: str = "mongodb://localhost:27017/ambient_ai"
    REDIS_URL: str = "redis://localhost:6379/0"
    FHIR_URL: str = "http://localhost:8080"
    
    # AI Providers
    WHISPER_PROVIDER: str = "local" # mock, local, openai, groq
    WHISPER_MODEL: str = "small" # base, small, medium, large-v3
    MEDIA_PIPE_ENABLED: bool = True
    MEDICAL_NLP_PROVIDER: str = "llm" # mock, llm
    
    # External API Keys (Optional)
    OPENAI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "phi3"
    TWILIO_SID: Optional[str] = None
    TWILIO_TOKEN: Optional[str] = None
    TWILIO_NUMBER: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()

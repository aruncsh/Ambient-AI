from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "Ambient AI Scribe"
    VERSION: str = "2.0.0"
    
    # Security
    SECRET_KEY: str = "y-r_super_secret_key_change_in_prod"
    ENCRYPTION_KEY: str = "r9xUqe4lisT2RVcGV3YE72oTi_oorwt5vv8Lu7COFt18="
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    ALGORITHM: str = "HS256"


    
    # Infrastructure
    MONGO_URL: str = "mongodb+srv://ambinetAI:jvGCRs0c0dZZ9tUb@cluster0.sa6kfex.mongodb.net/ambient_ai?appName=Cluster0"
    REDIS_URL: str = "redis://localhost:6379/0"
    FHIR_URL: str = "http://localhost:8080"
    
    # AI Providers
    WHISPER_PROVIDER: str = "local" # mock, local, openai, groq
    WHISPER_MODEL: str = "small" # base, small, medium, large-v3
    MEDIA_PIPE_ENABLED: bool = True
    MEDICAL_NLP_PROVIDER: str = "llm" # mock, llm
    
    # External API Keys (Optional)
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_API_MODEL: str = "gpt-3.5-turbo"
    GROQ_API_KEY: Optional[str] = None
    OLLAMA_URL: Optional[str] = None
    OLLAMA_MODEL: str = "llama3.2:latest"
    TWILIO_SID: Optional[str] = None
    TWILIO_TOKEN: Optional[str] = None
    TWILIO_NUMBER: Optional[str] = None

    # CureSelect Microservice
    CURESELECT_API_ENDPOINT: str = "https://services-api.a2zhealth.in/"
    CURESELECT_API_CLIENT_ID: Optional[str] = "televet-v3-staging"
    CURESELECT_API_CLIENT_SECRET: Optional[str] = "83fef8ec35f37968a9b684a5c400a54a"
    CURESELECT_ENTITY_ID: str = "25"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "allow"

settings = Settings()

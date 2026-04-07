from cryptography.fernet import Fernet
from app.core.config import settings

import logging

logger = logging.getLogger(__name__)

try:
    _fernet = Fernet(settings.ENCRYPTION_KEY.encode())
except Exception as e:
    logger.error(f"Failed to initialize Fernet with ENCRYPTION_KEY: {str(e)}")
    # Fallback for development only - in production this will still cause issues but we provided a better log
    _fernet = Fernet(Fernet.generate_key())
    logger.warning("Generated a temporary encryption key. Data encrypted in this session will NOT be decryptable after restart.")

def encrypt_data(data: str) -> str:
    if not data: return ""
    return _fernet.encrypt(data.encode()).decode()

def decrypt_data(encrypted_data: str) -> str:
    if not encrypted_data: return ""
    return _fernet.decrypt(encrypted_data.encode()).decode()

def encrypt_bytes(data: bytes) -> bytes:
    if not data: return b""
    return _fernet.encrypt(data)

def decrypt_bytes(encrypted_data: bytes) -> bytes:
    if not encrypted_data: return b""
    return _fernet.decrypt(encrypted_data)

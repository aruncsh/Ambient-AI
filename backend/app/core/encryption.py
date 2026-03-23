from cryptography.fernet import Fernet
from app.core.config import settings

_fernet = Fernet(settings.ENCRYPTION_KEY.encode())

def encrypt_data(data: str) -> str:
    if not data: return ""
    return _fernet.encrypt(data.encode()).decode()

def decrypt_data(encrypted_data: str) -> str:
    if not encrypted_data: return ""
    return _fernet.decrypt(encrypted_data.encode()).decode()

from cryptography.fernet import Fernet
from app.core.config import settings

_fernet = Fernet(settings.ENCRYPTION_KEY.encode())

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

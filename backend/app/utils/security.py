import os
import base64
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import padding
import logging

logger = logging.getLogger(__name__)

# Fallback for development, should be loaded from env
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "c2VjcmV0LWtleS1tdXN0LWJlLTMyLWJ5dGVzLWxvbmctISEh")

def get_key():
    return base64.b64decode(ENCRYPTION_KEY)

def encrypt_data(data: str) -> str:
    """Encrypts data using AES-256 (CBC)."""
    try:
        key = get_key()
        iv = os.urandom(16)
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
        encryptor = cipher.encryptor()
        
        padder = padding.PKCS7(128).padder()
        padded_data = padder.update(data.encode()) + padder.finalize()
        
        encrypted_content = encryptor.update(padded_data) + encryptor.finalize()
        return base64.b64encode(iv + encrypted_content).decode()
    except Exception as e:
        logger.error(f"Encryption failed: {e}")
        return data # Fallback to plaintext for dev if key fails

def decrypt_data(encrypted_data: str) -> str:
    """Decrypts data using AES-256 (CBC)."""
    try:
        key = get_key()
        raw_data = base64.b64decode(encrypted_data)
        iv = raw_data[:16]
        encrypted_content = raw_data[16:]
        
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
        decryptor = cipher.decryptor()
        
        decrypted_padded = decryptor.update(encrypted_content) + decryptor.finalize()
        unpadder = padding.PKCS7(128).unpadder()
        decrypted_data = unpadder.update(decrypted_padded) + unpadder.finalize()
        
        return decrypted_data.decode()
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        return encrypted_data

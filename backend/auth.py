import hashlib
import os
import secrets
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from dotenv import load_dotenv

_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config.env")
load_dotenv(_env_path)

SECRET_KEY = os.environ.get("SECRET_KEY", "quiniela_mundial_2026_super_secret_key_change_me_in_prod")
serializer = URLSafeTimedSerializer(SECRET_KEY, salt="auth-salt")

def hash_password(password: str) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with a unique salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000  # 100k iterations
    )
    return f"{salt}:{key.hex()}"

def verify_password(password: str, hashed_password: str) -> bool:
    """Verify a password against its stored hash."""
    try:
        salt, stored_hash = hashed_password.split(':')
        key = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        )
        return secrets.compare_digest(key.hex(), stored_hash)
    except Exception:
        return False

def generate_token(user_id: int, username: str, is_admin: bool = False) -> str:
    """Generate a secure, signed token for session authentication."""
    return serializer.dumps({
        "user_id": user_id,
        "username": username,
        "is_admin": is_admin
    })

def verify_token(token: str, max_age: int = 604800) -> dict:
    """Verify token integrity and expiration (default: 7 days)."""
    try:
        return serializer.loads(token, max_age=max_age)
    except (SignatureExpired, BadSignature):
        return None

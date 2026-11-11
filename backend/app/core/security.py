"""Password hashing and session-token helpers.

Passwords use stdlib scrypt with a per-user salt. Session tokens are random strings
handed to the browser; only their SHA-256 digest is stored, so a copied database
cannot be used to hijack live sessions.
"""

import hashlib
import hmac
import secrets

_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1
_SCRYPT_DKLEN = 32
_SCHEME = "scrypt"


def _derive(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
        dklen=_SCRYPT_DKLEN,
    )


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    return f"{_SCHEME}${salt.hex()}${_derive(password, salt).hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        scheme, salt_hex, digest_hex = stored_hash.split("$")
        if scheme != _SCHEME:
            return False
        expected = bytes.fromhex(digest_hex)
        actual = _derive(password, bytes.fromhex(salt_hex))
    except ValueError:
        return False
    return hmac.compare_digest(actual, expected)


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

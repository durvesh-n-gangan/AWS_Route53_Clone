"""Identifier generators that imitate the shape of Route53 IDs."""

import secrets
import string
import uuid

_ID_ALPHABET = string.ascii_uppercase + string.digits
_ID_BODY_LENGTH = 20


def _random_body(length: int = _ID_BODY_LENGTH) -> str:
    return "".join(secrets.choice(_ID_ALPHABET) for _ in range(length))


def new_zone_id() -> str:
    """Hosted zone ID such as `Z04A1B2C3D4E5F6G7H8I9` (Z + 20 characters)."""
    return f"Z{_random_body()}"


def new_record_id() -> str:
    """Record set ID such as `R0Q9W8E7R6T5Y4U3I2O1P` (R + 20 characters)."""
    return f"R{_random_body()}"


def new_caller_reference() -> str:
    return str(uuid.uuid4())


def new_account_id() -> str:
    """Mock 12-digit AWS account number that never starts with 0."""
    return str(secrets.randbelow(9 * 10**11) + 10**11)

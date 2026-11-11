"""Name normalisation shared by zones and records.

Per-type record value validation lives in record_validation.py.
"""

import re

MAX_DOMAIN_LENGTH = 253
MAX_LABEL_LENGTH = 63
# Letters, digits, hyphens and underscores; no leading or trailing hyphen.
_LABEL = re.compile(r"^[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?$")


def validate_domain_name(name: str) -> str:
    """Return the normalised FQDN, or raise ValueError with a console-style message."""
    fqdn = normalize_fqdn(name)
    bare = fqdn.rstrip(".")
    if not bare:
        raise ValueError("Enter a domain name.")
    if len(bare) > MAX_DOMAIN_LENGTH:
        raise ValueError(f"The domain name can have up to {MAX_DOMAIN_LENGTH} characters.")
    labels = bare.split(".")
    if len(labels) < 2:
        raise ValueError("Enter a fully qualified domain name, such as example.com.")
    for label in labels:
        if not label:
            raise ValueError("The domain name can't contain empty labels (two dots in a row).")
        if len(label) > MAX_LABEL_LENGTH:
            raise ValueError(
                f"Each label in the domain name can have up to {MAX_LABEL_LENGTH} characters."
            )
        if not _LABEL.match(label):
            raise ValueError(
                f"The label '{label}' is not valid. Use letters, numbers and hyphens, and don't "
                "start or end a label with a hyphen."
            )
    if labels[-1].isdigit():
        raise ValueError("The top-level domain can't be all numbers.")
    return fqdn


def normalize_fqdn(name: str) -> str:
    """Lowercase, trim and ensure exactly one trailing dot: `Example.COM` -> `example.com.`."""
    cleaned = name.strip().lower().rstrip(".")
    return f"{cleaned}."


def qualify_record_name(name: str, zone_name: str) -> str:
    """Turn a console-style record name into an FQDN inside the zone.

    `""` or `"@"` -> the zone apex; `"www"` -> `www.example.com.`; a name already ending in
    the zone name is kept as is. Whether the result really sits inside the zone is
    checked by record validation.
    """
    zone_fqdn = normalize_fqdn(zone_name)
    cleaned = name.strip().lower()
    if cleaned in ("", "@"):
        return zone_fqdn
    if cleaned.endswith("."):
        return cleaned
    bare_zone = zone_fqdn.rstrip(".")
    if cleaned == bare_zone or cleaned.endswith(f".{bare_zone}"):
        return f"{cleaned}."
    return f"{cleaned}.{zone_fqdn}"

"""Name normalisation shared by zones and records.

Per-type record value validation is added in Phase 6 (see docs/PLAN.md §5.5).
"""


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

"""Per-type validation of record sets, with console-style error messages.

Each check produces a friendly message first; dnspython then parses the normalised value as a
final guard, so anything stored here is valid zone-file syntax.
"""

import ipaddress
import re
from dataclasses import dataclass

import dns.exception
import dns.rdata
import dns.rdataclass
import dns.rdatatype

from app.models.record import MAX_TTL
from app.services.validation import (
    MAX_DOMAIN_LENGTH,
    MAX_LABEL_LENGTH,
    normalize_fqdn,
    qualify_record_name,
)

# Types a user may create. SOA exists only as the zone's default record.
CREATABLE_TYPES = ("A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA")
MAX_VALUES = 100
MAX_VALUE_LENGTH = 4000
MAX_TXT_STRING = 255
CAA_TAGS = ("issue", "issuewild", "iodef", "issuemail")

_HOST_LABEL = re.compile(r"^[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?$", re.IGNORECASE)
_TXT_TOKEN = re.compile(r'"((?:[^"\\]|\\.)*)"')


class RecordValidationError(ValueError):
    """A problem with one field of a record set: "name", "type", "ttl" or "values"."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.field = field
        self.message = message


@dataclass(frozen=True)
class ValidRecord:
    name: str
    type: str
    ttl: int
    values: list[str]


def _host_problem(text: str) -> str | None:
    """Return why `text` is not a usable host name, or None if it is fine."""
    try:
        ipaddress.ip_address(text.rstrip("."))
        return "Enter a domain name, not an IP address."
    except ValueError:
        pass
    bare = text.rstrip(".")
    if not bare:
        return "Enter a domain name."
    if len(bare) > MAX_DOMAIN_LENGTH:
        return f"A domain name can have up to {MAX_DOMAIN_LENGTH} characters."
    for label in bare.split("."):
        if not label:
            return "A domain name can't contain two dots in a row."
        if len(label) > MAX_LABEL_LENGTH:
            return f"Each label can have up to {MAX_LABEL_LENGTH} characters."
        if not _HOST_LABEL.match(label):
            return "Use only letters, numbers, hyphens and underscores in a domain name."
    return None


def _host(value: str, *, kind: str = "domain name") -> str:
    problem = _host_problem(value)
    if problem:
        raise RecordValidationError("values", f"{value} is not a valid {kind}. {problem}")
    return normalize_fqdn(value)


def _uint(text: str, upper: int, what: str, value: str) -> int:
    if not text.isdigit() or int(text) > upper:
        raise RecordValidationError(
            "values", f"{value}: the {what} must be a whole number from 0 to {upper}."
        )
    return int(text)


def _check_a(value: str) -> str:
    try:
        return str(ipaddress.IPv4Address(value))
    except ValueError:
        raise RecordValidationError(
            "values", f"{value} is not a valid IPv4 address, such as 192.0.2.235."
        ) from None


def _check_aaaa(value: str) -> str:
    try:
        return str(ipaddress.IPv6Address(value))
    except ValueError:
        raise RecordValidationError(
            "values", f"{value} is not a valid IPv6 address, such as 2001:db8::1."
        ) from None


def _check_mx(value: str) -> str:
    parts = value.split()
    if len(parts) != 2:
        raise RecordValidationError(
            "values",
            f"{value}: use the format 'priority mail-server', such as 10 mail.example.com.",
        )
    priority = _uint(parts[0], 65535, "priority", value)
    return f"{priority} {_host(parts[1], kind='mail server name')}"


def _check_srv(value: str) -> str:
    parts = value.split()
    if len(parts) != 4:
        raise RecordValidationError(
            "values",
            f"{value}: use the format 'priority weight port target', such as "
            "10 5 5060 sip.example.com.",
        )
    priority = _uint(parts[0], 65535, "priority", value)
    weight = _uint(parts[1], 65535, "weight", value)
    port = _uint(parts[2], 65535, "port", value)
    target = "." if parts[3] == "." else _host(parts[3], kind="target")
    return f"{priority} {weight} {port} {target}"


def _check_caa(value: str) -> str:
    match = re.fullmatch(r'(\S+)\s+(\S+)\s+"(.*)"', value)
    if not match:
        raise RecordValidationError(
            "values",
            f'{value}: use the format \'flags tag "value"\', such as 0 issue "ca.example.net".',
        )
    flags = _uint(match.group(1), 255, "flags value", value)
    tag = match.group(2).lower()
    if tag not in CAA_TAGS:
        raise RecordValidationError(
            "values", f"{value}: the tag must be one of {', '.join(CAA_TAGS)}."
        )
    return f'{flags} {tag} "{match.group(3)}"'


def _check_txt(value: str) -> str:
    """Accepts one or more quoted strings, or a single unquoted string, each ≤ 255 chars."""
    if value.startswith('"'):
        chunks = _TXT_TOKEN.findall(value)
        if _TXT_TOKEN.sub("", value).strip() or not chunks:
            raise RecordValidationError(
                "values", 'Enclose each TXT string in quotation marks, such as "v=spf1 -all".'
            )
    else:
        if '"' in value:
            raise RecordValidationError(
                "values", 'Enclose the whole TXT string in quotation marks, such as "a b".'
            )
        chunks = [value]
    for chunk in chunks:
        if len(chunk.replace('\\"', '"')) > MAX_TXT_STRING:
            raise RecordValidationError(
                "values",
                f"Each TXT string can have up to {MAX_TXT_STRING} characters. Split longer "
                'values into several quoted strings: "first part" "second part".',
            )
    return " ".join(f'"{chunk}"' for chunk in chunks)


def _check_soa(value: str) -> str:
    parts = value.split()
    if len(parts) != 7:
        raise RecordValidationError(
            "values",
            "An SOA value has seven fields: primary name server, admin email, serial, refresh, "
            "retry, expire and minimum TTL.",
        )
    primary = _host(parts[0], kind="name server")
    admin = _host(parts[1], kind="admin email domain")
    numbers = [_uint(part, 4_294_967_295, "SOA timer", value) for part in parts[2:]]
    return " ".join([primary, admin, *map(str, numbers)])


_VALUE_CHECKS = {
    "A": _check_a,
    "AAAA": _check_aaaa,
    "CNAME": lambda value: _host(value),
    "TXT": _check_txt,
    "MX": _check_mx,
    "NS": lambda value: _host(value, kind="name server"),
    "PTR": lambda value: _host(value),
    "SRV": _check_srv,
    "CAA": _check_caa,
    "SOA": _check_soa,
}


def validate_record_name(name: str, zone_name: str) -> str:
    """Qualify a console-style name and make sure it sits inside the zone."""
    fqdn = qualify_record_name(name, zone_name)
    zone_fqdn = normalize_fqdn(zone_name)
    if fqdn != zone_fqdn and not fqdn.endswith(f".{zone_fqdn}"):
        raise RecordValidationError(
            "name", f"The record name must be in the zone {zone_fqdn.rstrip('.')}."
        )
    relative = fqdn[: -len(zone_fqdn)].rstrip(".")
    labels = relative.split(".") if relative else []
    for index, label in enumerate(labels):
        if label == "*" and index == 0:
            continue  # wildcard records (*.example.com) are allowed
        if not label or len(label) > MAX_LABEL_LENGTH or not _HOST_LABEL.match(label):
            raise RecordValidationError(
                "name",
                "Record names can contain letters, numbers, hyphens and underscores, and can "
                "start with *. for a wildcard record.",
            )
    if len(fqdn.rstrip(".")) > MAX_DOMAIN_LENGTH:
        raise RecordValidationError(
            "name", f"A record name can have up to {MAX_DOMAIN_LENGTH} characters."
        )
    return fqdn


def validate_record(
    zone_name: str,
    *,
    name: str,
    record_type: str,
    ttl: int,
    values: list[str],
    allow_soa: bool = False,
) -> ValidRecord:
    """Validate and normalise one record set. Raises RecordValidationError."""
    record_type = record_type.upper()
    if record_type not in CREATABLE_TYPES and not (allow_soa and record_type == "SOA"):
        raise RecordValidationError(
            "type",
            "SOA records are created automatically with the hosted zone."
            if record_type == "SOA"
            else f"{record_type} records are not supported.",
        )
    fqdn = validate_record_name(name, zone_name)

    if not 0 <= ttl <= MAX_TTL:
        raise RecordValidationError("ttl", f"The TTL must be between 0 and {MAX_TTL} seconds.")

    cleaned = [value.strip() for value in values if value.strip()]
    if not cleaned:
        raise RecordValidationError("values", "Enter a value.")
    if len(cleaned) > MAX_VALUES:
        raise RecordValidationError("values", f"A record can have up to {MAX_VALUES} values.")
    if record_type in ("CNAME", "SOA") and len(cleaned) > 1:
        raise RecordValidationError("values", f"A {record_type} record can have only one value.")
    if record_type == "CNAME" and fqdn == normalize_fqdn(zone_name):
        raise RecordValidationError(
            "type",
            f"A CNAME record can't be created at the zone apex ({zone_name.rstrip('.')}). "
            "Use an A or AAAA record instead.",
        )

    normalised: list[str] = []
    for value in cleaned:
        if len(value) > MAX_VALUE_LENGTH:
            raise RecordValidationError(
                "values", f"Each value can have up to {MAX_VALUE_LENGTH} characters."
            )
        result = _VALUE_CHECKS[record_type](value)
        try:
            dns.rdata.from_text(dns.rdataclass.IN, dns.rdatatype.from_text(record_type), result)
        except (dns.exception.DNSException, ValueError) as exc:
            raise RecordValidationError(
                "values", f"{value} is not a valid {record_type} value."
            ) from exc
        if result in normalised:
            raise RecordValidationError("values", f"The value {value} is listed more than once.")
        normalised.append(result)

    return ValidRecord(name=fqdn, type=record_type, ttl=ttl, values=normalised)

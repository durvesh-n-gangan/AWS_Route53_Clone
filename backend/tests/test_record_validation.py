"""Per-type record validation matrix."""

import pytest

from app.services.record_validation import RecordValidationError, validate_record

ZONE = "example.com."


def _validate(record_type: str, values: list[str], name: str = "www", ttl: int = 300):
    return validate_record(ZONE, name=name, record_type=record_type, ttl=ttl, values=values)


@pytest.mark.parametrize(
    ("record_type", "values", "expected"),
    [
        ("A", ["192.0.2.10"], ["192.0.2.10"]),
        ("A", ["192.0.2.10", " 198.51.100.7 ", ""], ["192.0.2.10", "198.51.100.7"]),
        ("AAAA", ["2001:DB8:0:0::1"], ["2001:db8::1"]),
        ("CNAME", ["target.example.org"], ["target.example.org."]),
        ("TXT", ['"v=spf1 -all"'], ['"v=spf1 -all"']),
        ("TXT", ["unquoted-token"], ['"unquoted-token"']),
        ("TXT", [f'"{"a" * 255}" "{"b" * 255}"'], [f'"{"a" * 255}" "{"b" * 255}"']),
        ("TXT", [r'"say \"hi\""'], [r'"say \"hi\""']),
        ("MX", ["10 mail.example.com"], ["10 mail.example.com."]),
        ("MX", ["0 mx.example.net."], ["0 mx.example.net."]),
        ("NS", ["ns1.example.net"], ["ns1.example.net."]),
        ("PTR", ["host.example.com"], ["host.example.com."]),
        ("SRV", ["10 5 5060 sip.example.com"], ["10 5 5060 sip.example.com."]),
        ("SRV", ["0 0 0 ."], ["0 0 0 ."]),
        ("CAA", ['0 issue "letsencrypt.org"'], ['0 issue "letsencrypt.org"']),
        (
            "CAA",
            ['128 IODEF "mailto:security@example.com"'],
            ['128 iodef "mailto:security@example.com"'],
        ),
    ],
)
def test_valid_values_are_accepted_and_normalised(record_type, values, expected) -> None:
    assert _validate(record_type, values).values == expected


@pytest.mark.parametrize(
    ("record_type", "values"),
    [
        ("A", ["256.1.1.1"]),
        ("A", ["2001:db8::1"]),
        ("A", ["abc"]),
        ("A", ["192.0.2.01"]),
        ("AAAA", ["192.0.2.1"]),
        ("AAAA", ["2001:db8:::1"]),
        ("CNAME", ["a.example.org", "b.example.org"]),
        ("CNAME", ["192.0.2.1"]),
        ("TXT", ["x" * 256]),
        ("TXT", [f'"{"x" * 256}"']),
        ("TXT", ['"unterminated']),
        ("TXT", ['bad"quote']),
        ("MX", ["mail.example.com"]),
        ("MX", ["70000 mail.example.com"]),
        ("MX", ["-1 mail.example.com"]),
        ("NS", ["192.0.2.1"]),
        ("NS", ["-bad-.example.com"]),
        ("PTR", ["not a host!"]),
        ("SRV", ["10 5 sip.example.com"]),
        ("SRV", ["10 5 70000 sip.example.com"]),
        ("CAA", ['0 badtag "x"']),
        ("CAA", ['300 issue "x"']),
        ("CAA", ["0 issue unquoted"]),
        ("A", ["192.0.2.1", "192.0.2.1"]),
        ("A", ["", "  "]),
    ],
)
def test_invalid_values_are_rejected_with_a_values_message(record_type, values) -> None:
    with pytest.raises(RecordValidationError) as excinfo:
        _validate(record_type, values)
    assert excinfo.value.field == "values"
    assert excinfo.value.message


def test_cname_cannot_be_created_at_the_apex() -> None:
    with pytest.raises(RecordValidationError) as excinfo:
        _validate("CNAME", ["target.example.org"], name="@")
    assert excinfo.value.field == "type"
    assert "apex" in excinfo.value.message


@pytest.mark.parametrize("ttl", [0, 300, 2_147_483_647])
def test_ttl_boundaries_are_accepted(ttl: int) -> None:
    assert _validate("A", ["192.0.2.1"], ttl=ttl).ttl == ttl


@pytest.mark.parametrize("ttl", [-1, 2_147_483_648])
def test_ttl_outside_range_is_rejected(ttl: int) -> None:
    with pytest.raises(RecordValidationError) as excinfo:
        _validate("A", ["192.0.2.1"], ttl=ttl)
    assert excinfo.value.field == "ttl"


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("www", "www.example.com."),
        ("www.example.com", "www.example.com."),
        ("WWW.Example.Com.", "www.example.com."),
        ("@", "example.com."),
        ("", "example.com."),
        ("*.apps", "*.apps.example.com."),
        ("_dmarc", "_dmarc.example.com."),
    ],
)
def test_names_are_qualified_inside_the_zone(name: str, expected: str) -> None:
    assert _validate("A", ["192.0.2.1"], name=name).name == expected


@pytest.mark.parametrize("name", ["www.other.com.", "example.com.evil.org.", "a b", "x.*", "-x"])
def test_bad_or_out_of_zone_names_are_rejected(name: str) -> None:
    with pytest.raises(RecordValidationError) as excinfo:
        _validate("A", ["192.0.2.1"], name=name)
    assert excinfo.value.field == "name"


def test_soa_cannot_be_created_but_can_be_validated_for_the_default_record() -> None:
    soa = "ns-1.awsdns-01.com. awsdns-hostmaster.amazon.com. 2 7200 900 1209600 86400"
    with pytest.raises(RecordValidationError) as excinfo:
        _validate("SOA", [soa], name="@")
    assert excinfo.value.field == "type"

    result = validate_record(
        ZONE, name="@", record_type="SOA", ttl=900, values=[soa], allow_soa=True
    )
    assert result.values == [soa]

"""Phone numbers: one normal form for storing and one key for matching (ported from uzbridge).

PBXes, forms and people write the same number many ways (+998 90 123-45-67,
998901234567, 901234567, 0901234567). We keep digits only and compare on the
last 9 digits — an Uzbek subscriber number — so all of those meet.
"""

import re

_DIGITS = re.compile(r"\D+")


def digits(raw: str | None) -> str:
    return _DIGITS.sub("", raw or "")


def normalize(raw: str | None) -> str:
    """'+998901234567' for a 9-digit local / 12-digit UZ number; other numbers as '+<digits>'."""
    d = digits(raw)
    if not d:
        return ""
    if len(d) == 9:
        d = "998" + d
    elif len(d) == 10 and d.startswith("0"):
        d = "998" + d[1:]
    return "+" + d if len(d) >= 7 else d


def key(raw: str | None) -> str:
    """The matching key: the last 9 digits (empty for internal extensions and junk)."""
    d = digits(raw)
    return d[-9:] if len(d) >= 7 else ""


def is_internal(raw: str | None) -> bool:
    """A PBX extension (101, 2001…), not a phone number."""
    d = digits(raw)
    return 0 < len(d) <= 5


def pretty(raw: str | None) -> str:
    """'+998 90 123 45 67' for UZ numbers, the normal form otherwise."""
    n = normalize(raw)
    d = digits(n)
    if len(d) == 12 and d.startswith("998"):
        return f"+998 {d[3:5]} {d[5:8]} {d[8:10]} {d[10:]}"
    return n

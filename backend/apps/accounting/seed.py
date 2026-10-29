"""Chart of accounts + roles from fixtures/nsbu21.json. Shared by the management command and tests."""

import json
from pathlib import Path

from apps.accounting.models import Account, AccountRole

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "nsbu21.json"


def seed_chart() -> tuple[int, int]:
    """Upsert every account by code (names and kinds refresh, user-added accounts stay) and create the
    roles that are missing. An existing role keeps the account the accountant mapped it to."""
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    by_code: dict[str, Account] = {a.code: a for a in Account.objects.all()}
    for row in data["accounts"]:
        acc = by_code.get(row["code"])
        fields = dict(name=row["name"], kind=row["kind"], allow_posting=row.get("allow_posting", True))
        if acc is None:
            acc = Account.objects.create(code=row["code"], **fields)
            by_code[acc.code] = acc
        else:
            for k, v in fields.items():
                setattr(acc, k, v)
            acc.save(update_fields=[*fields, "updated_at"])
    for row in data["accounts"]:  # parents in a second pass: groups may come after their children
        acc = by_code[row["code"]]
        parent = by_code.get(row["parent"]) if row.get("parent") else None
        if acc.parent_id != (parent.pk if parent else None):
            acc.parent = parent
            acc.save(update_fields=["parent", "updated_at"])
    created = 0
    for row in data["roles"]:
        _, was_created = AccountRole.objects.get_or_create(
            key=row["key"], defaults={"label": row["label"], "account": by_code[row["account"]]})
        created += was_created
    return len(data["accounts"]), created

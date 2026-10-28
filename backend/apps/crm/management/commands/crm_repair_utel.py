"""One-off repair (uzbridge crm_repair_utel): before the company's own UTeL line was known, calls could take
it for the client — every call then pointed at one "client" (the company) and its lead.

Dry run by default; --apply writes. It recomputes each non-internal call's client number from its last stored
PBX event without the company's lines, soft-deletes leads whose only number is a company line (unless they
became a Loyiha), and relinks calls to existing clients / open leads (it never creates any).
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.crm import phones, selectors
from apps.crm.models import Call, CallDirection, Connection, Lead


class Command(BaseCommand):
    help = "Repair calls / leads where a UTeL company line was taken for a client (dry run unless --apply)."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true")

    def handle(self, *args, apply=False, **options):
        own = set()
        for conn in Connection.objects.filter(kind=Connection.Kind.UTEL):
            own |= {phones.key(n) for n in str((conn.config or {}).get("numbers") or "").split(",") if phones.key(n)}
        if not own:
            self.stdout.write("UTeL ulanishlarida kompaniya raqamlari yo'q — tuzatadigan narsa yo'q")
            return
        fixed = relinked = 0
        with transaction.atomic():
            bad_leads = [ld for ld in Lead.objects.filter(project__isnull=True) if phones.key(ld.phone) in own]
            for call in Call.objects.exclude(direction=CallDirection.INTERNAL):
                events = (call.raw or {}).get("events") or []
                last = events[-1] if events else {}
                raw = str(last.get("from") if call.direction == "in" else last.get("to") or "")
                number = phones.normalize(raw) if phones.key(raw) and phones.key(raw) not in own else ""
                if number == call.client_phone and phones.key(call.client_phone) not in own:
                    continue
                fixed += 1
                call.client_phone = number[:20]
                call.client = selectors.client_by_phone(number) if number else None
                call.lead = selectors.open_lead_by_phone(number) if number else None
                relinked += int(call.lead_id is not None)
                if apply:
                    call.save(update_fields=["client_phone", "client", "lead", "updated_at"])
            self.stdout.write(f"qo'ng'iroqlar tuzatiladi: {fixed} (lidga bog'lanadi: {relinked}); "
                              f"kompaniya raqamli lidlar: {len(bad_leads)}")
            if apply:
                for ld in bad_leads:
                    ld.soft_delete()
            else:
                transaction.set_rollback(True)
        self.stdout.write(self.style.SUCCESS("bajarildi") if apply else "sinov (--apply bilan yoziladi)")

"""Central Bank of Uzbekistan rates → ExchangeRate. `manage.py fetch_cbu_rates [--date YYYY-MM-DD] [--currency USD]`.
Run daily from cron; a day that already has a manual rate is overwritten only with --force."""

import datetime as dt

import httpx
from django.core.management.base import BaseCommand, CommandError

from apps.accounting.models import ExchangeRate
from apps.accounting.services import rate_set

CBU_URL = "https://cbu.uz/uz/arkhiv-kursov-valyut/json/{currency}/{date:%Y-%m-%d}/"
TRANSPORT: httpx.BaseTransport | None = None  # tests set an httpx.MockTransport


def fetch_rate(currency: str, date: dt.date) -> tuple[dt.date, str]:
    """(date the Bank published for, rate as string). The Bank repeats the last working day's rate on weekends."""
    with httpx.Client(transport=TRANSPORT, timeout=httpx.Timeout(15.0)) as c:
        r = c.get(CBU_URL.format(currency=currency, date=date))
    r.raise_for_status()
    rows = r.json()
    if not rows:
        raise CommandError(f"CBU: {currency} uchun {date} kursi yo'q")
    row = rows[0]
    published = dt.datetime.strptime(row["Date"], "%d.%m.%Y").date()
    return published, row["Rate"]


class Command(BaseCommand):
    help = "Fetch the Central Bank rate for a day (default today) into the exchange rate table."

    def add_arguments(self, parser):
        parser.add_argument("--date", default=None, help="YYYY-MM-DD (default: today)")
        parser.add_argument("--currency", default="USD")
        parser.add_argument("--force", action="store_true", help="overwrite a manually entered rate")

    def handle(self, *args, **options):
        date = dt.date.fromisoformat(options["date"]) if options["date"] else dt.date.today()
        currency = options["currency"].upper()
        existing = ExchangeRate.objects.filter(date=date, currency=currency).first()
        if existing is not None and existing.source == "manual" and not options["force"]:
            self.stdout.write(f"{currency} {date}: qo'lda kiritilgan kurs bor ({existing.rate}), o'zgartirilmadi")
            return
        try:
            _, rate = fetch_rate(currency, date)
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            raise CommandError(f"CBU so'rovi muvaffaqiyatsiz: {exc}") from exc
        row = rate_set(date=date, currency=currency, rate=rate, source="cbu")
        self.stdout.write(self.style.SUCCESS(f"{currency} {date}: {row.rate}"))

from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.core.exceptions import DomainError
from apps.specs import openspec, services


class Command(BaseCommand):
    help = "Copy openspec/ (project, specs, changes, archive) into the database. Idempotent; run after migrate."

    def add_arguments(self, parser):
        parser.add_argument("--dir", default=None, help="OpenSpec folder (default: settings.OPENSPEC_DIR)")
        parser.add_argument("--check", action="store_true", help="also print consistency problems")

    def handle(self, *args, dir=None, check=False, **options):
        root = Path(dir or settings.OPENSPEC_DIR)
        try:
            stats = services.specs_sync(root)
        except DomainError as e:
            raise CommandError(e.message) from e
        self.stdout.write(self.style.SUCCESS(
            "specs_sync: {created} created, {updated} updated, {unchanged} unchanged, {deleted} deleted".format(**stats)
        ))
        if check:
            problems = openspec.problems(openspec.read_tree(root))
            for p in problems:
                self.stdout.write(self.style.WARNING(p))
            if not problems:
                self.stdout.write("openspec: no problems")

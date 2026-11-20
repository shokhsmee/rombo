from django.apps import AppConfig


class KonstruktorConfig(AppConfig):
    name = "apps.konstruktor"
    label = "konstruktor"
    verbose_name = "Konstruktor (chizmalar)"

    def ready(self):
        # projects never imports konstruktor (ADR 0015): the card reads a block, items follow constructions
        from apps.projects.extensions import register_detail_block, register_items_source

        def has_constructions(project) -> bool:
            return project.constructions.filter(deleted_at__isnull=True).exists()

        register_items_source(has_constructions)
        register_detail_block("constructions", lambda p: {
            "count": p.constructions.filter(deleted_at__isnull=True).count()})

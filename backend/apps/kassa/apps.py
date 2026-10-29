from django.apps import AppConfig


class KassaConfig(AppConfig):
    name = "apps.kassa"
    label = "kassa"
    verbose_name = "Kassa va bank"

    def ready(self):
        # the Loyiha card shows its payments and derives the advance from them; projects never imports kassa
        from apps.kassa.selectors import project_advance, project_payments
        from apps.projects.extensions import register_advance_source, register_detail_block

        # strings, not Decimals: DRF's JSON encoder would render raw Decimals as floats
        register_detail_block("payments", lambda p: {k: (None if v is None else str(v))
                                                     for k, v in project_payments(p).items()})
        register_advance_source(project_advance)

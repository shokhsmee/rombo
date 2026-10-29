from django.apps import AppConfig


class KassaConfig(AppConfig):
    name = "apps.kassa"
    label = "kassa"
    verbose_name = "Kassa va bank"

    def ready(self):
        # the Loyiha card shows its payments and derives the advance from them; projects never imports kassa
        from apps.kassa.selectors import project_advance, project_payments
        from apps.projects.extensions import register_detail_extra

        register_detail_extra("payments", project_payments)
        register_detail_extra("advance", project_advance)

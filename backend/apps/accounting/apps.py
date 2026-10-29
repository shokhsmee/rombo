from django.apps import AppConfig


class AccountingConfig(AppConfig):
    name = "apps.accounting"
    label = "accounting"
    verbose_name = "Buxgalteriya"

    def ready(self):
        # the Loyiha card shows money from the ledger; projects never imports accounting (ADR 0007)
        from apps.accounting.selectors import project_money
        from apps.projects.extensions import register_detail_extra

        register_detail_extra("money", project_money)

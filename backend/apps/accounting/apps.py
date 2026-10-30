from django.apps import AppConfig


class AccountingConfig(AppConfig):
    name = "apps.accounting"
    label = "accounting"
    verbose_name = "Buxgalteriya"

    def ready(self):
        # the Loyiha card shows money from the ledger; projects never imports accounting (ADR 0007)
        from apps.accounting.selectors import project_money
        from apps.projects.extensions import register_detail_block

        # strings, not Decimals: DRF's JSON encoder would render raw Decimals as floats
        register_detail_block("money", lambda p: {k: v if isinstance(v, str) else str(v) for k, v in project_money(p).items()})

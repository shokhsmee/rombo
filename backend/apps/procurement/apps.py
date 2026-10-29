from django.apps import AppConfig


class ProcurementConfig(AppConfig):
    name = "apps.procurement"
    label = "procurement"
    verbose_name = "Xaridlar"

    def ready(self):
        # the Loyiha card shows a procurement block; projects never imports this app (AGENTS.md §2),
        # so the block registers itself here
        from apps.procurement.selectors import project_procurement
        from apps.projects.extensions import register_detail_block

        register_detail_block("procurement", project_procurement)

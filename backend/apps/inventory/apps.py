from django.apps import AppConfig


class InventoryConfig(AppConfig):
    name = "apps.inventory"
    label = "inventory"
    verbose_name = "Ombor"

    def ready(self):
        # the Loyiha card shows what went into it; projects never imports inventory
        from apps.inventory.selectors import project_block
        from apps.projects.extensions import register_detail_block

        register_detail_block("stock", project_block)

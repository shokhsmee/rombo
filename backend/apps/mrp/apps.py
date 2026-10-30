from django.apps import AppConfig


class MrpConfig(AppConfig):
    name = "apps.mrp"
    label = "mrp"
    verbose_name = "Ishlab chiqarish rejasi (MRP)"

    def ready(self):
        # the Loyiha freezes its materials on confirm and shows a materials block; projects never imports mrp
        from apps.mrp.selectors import frozen
        from apps.mrp.services import on_status
        from apps.projects.extensions import register_detail_block, register_status_listener

        register_status_listener(on_status)
        register_detail_block("materials", lambda p: {"frozen": frozen(p)})

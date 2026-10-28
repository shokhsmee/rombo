from django.apps import AppConfig


class ChatterConfig(AppConfig):
    name = "apps.chatter"
    label = "chatter"
    verbose_name = "Tarix va izohlar"

    def ready(self):
        from apps.chatter import tracking

        tracking.connect_all()

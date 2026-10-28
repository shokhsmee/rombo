"""ASGI entry: HTTP goes to Django, /ws/live/ to the live-updates socket (apps.core.consumers).
Production: `daphne -b 0.0.0.0 -p 8000 config.asgi:application` (or uvicorn); dev: `manage.py runserver`."""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402
from django.urls import path  # noqa: E402

from apps.core.consumers import LiveConsumer  # noqa: E402

application = ProtocolTypeRouter({
    "http": django_app,
    "websocket": AllowedHostsOriginValidator(URLRouter([path("ws/live/", LiveConsumer.as_asgi())])),
})

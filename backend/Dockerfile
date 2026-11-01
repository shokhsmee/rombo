# Rombo ERP backend: one image for the API (daphne), the Celery worker + beat and the Telegram listener.
# The command differs per service in docker-compose.yml.
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.13.5 /uv /usr/local/bin/uv

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# dependencies first: this layer is rebuilt only when pyproject.toml / uv.lock change
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --extra postgres --no-install-project

COPY . .

RUN useradd --system --uid 1000 --home /app rombo \
    && mkdir -p /data/media /data/beat /app/staticfiles \
    && chown -R rombo /data /app/staticfiles
USER rombo

ENV MEDIA_ROOT=/data/media
EXPOSE 8000
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]

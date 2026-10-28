# ADR 0005 — Record history (chatter) is written by signals

- Status: accepted
- Date: 2026-10-29
- Relates to: ADR 0002 (business logic lives in services)

## Context
Every record needs an Odoo-style history. Writing history lines by hand in every service would be
forgotten in some code paths (admin, commands, future modules).

## Decision
- One generic `chatter.Message` table keyed by `"app.model"` + `res_id`.
- Models opt in with `TRACK = {"field": "Label"}`. `post_init` snapshots, `post_save` compares and
  writes one `track` message; creation writes "<Name> yaratildi".
- The author comes from the current request (contextvar set by `ChatterMiddleware`), else "Tizim".
- Signals here only **observe**; they never change business data and swallow their own errors.
  ADR 0002 still forbids signals for business rules.
- Services may write richer lines (`post(obj, body, kind=..., changes=...)`) and use `muted()` to
  avoid duplicates.

## Consequences
- New modules get history for free. Bulk jobs must use `muted()` if they shouldn't fill history.
- `QuerySet.update()` bypasses signals — use it only where history is not wanted.

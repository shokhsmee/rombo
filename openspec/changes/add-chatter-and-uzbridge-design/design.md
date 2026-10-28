# Design: add-chatter-and-uzbridge-design

## Chatter storage: generic (model, res_id) vs. per-model log tables
Chosen: one `Message` table keyed by `"app_label.model_name"` + `res_id` (uzbridge's design).
- Any new module gets history by adding `TRACK` — no new table, no new endpoint, no new UI.
- Rejected: per-model `XxxLog` tables (what `ProjectStatusLog` was) — N tables, N endpoints, N widgets.
- Rejected: Django `GenericForeignKey` — needs `ContentType` joins and breaks if a model is renamed;
  the string label is stable, readable in SQL and matches the frontend prop `model="projects.project"`.

## Automatic tracking via signals
AGENTS.md / ADR 0002 say "no signals for business rules". Tracking is not a business rule: it never
changes data and must never block a save (errors are logged and swallowed). Writing it in every
service would be easy to forget. So: signals for *observing*, services for *deciding*. ADR 0005.

Who did it: DRF sets `HttpRequest.user` after JWT auth; `ChatterMiddleware` stores the request in a
contextvar and the user is read lazily at save time. Commands and seeds write as "Tizim" (system).

Services may post richer lines themselves: `project_change_status` saves `muted()` and posts one
`track` message carrying both the status change and the comment, instead of two lines.

## Permissions
`CHATTER_PAGES = {"projects.project": Pages.PROJECTS, ...}` maps a model to its page. Reading and
writing notes require `view` on that page — if you can see the record you can comment on it
(Odoo behaviour). Unknown models → 404, same as a missing record.

## UI library: Mantine → Tailwind + own kit
uzbridge's look is its tokens and a ~200-line kit, not a library. Re-theming Mantine would keep
Mantine's metrics and widgets and never quite match. Rewriting to the same kit gives an identical
feel, a smaller bundle and one less dependency. Cost: we write a few widgets Mantine gave for free
(searchable remote select, dialog, toast); native `<input type="date">` replaces the date picker.

## Not in this change
File attachments on messages (uzbridge has `Attachment`), @mentions, followers, activities/reminders.

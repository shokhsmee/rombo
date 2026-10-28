# Rombo ERP — rules for every contributor (human or AI)

Read this before changing anything. It keeps a large codebase from drifting.

## 1. Every change goes through OpenSpec

`openspec/` is the project's memory: **what** the system does (`specs/`), **what is changing
and why** (`changes/`), and **what changed before** (`changes/archive/`).

1. **Propose** — create `openspec/changes/<change-id>/` (kebab-case verb: `add-purchase-requests`):
   - `proposal.md` — Why · What changes · Impact (apps, tables, endpoints, pages).
   - `tasks.md` — checklist, ticked while implementing.
   - `design.md` — only for real decisions (new relations, cross-app flow, trade-offs).
     Write down the options you rejected and why.
   - `specs/<capability>/spec.md` — delta: `## ADDED|MODIFIED|REMOVED Requirements`,
     each requirement with at least one `#### Scenario:` (WHEN / THEN).
2. **Implement** — code + migration + tests. Tick `tasks.md`.
3. **Archive** — move to `openspec/changes/archive/YYYY-MM-DD-<change-id>/`, merge the deltas into
   `openspec/specs/<capability>/spec.md`, add a line to `CHANGELOG.md`.

Small fixes with no behaviour change skip the proposal but still get a CHANGELOG line.
Unsure? Write the proposal.

Cross-cutting architecture decisions also get an ADR in `docs/adr/NNNN-title.md`.
Accepted ADRs are never edited — supersede them with a new one.

With the OpenSpec CLI (`npm i -g @fission-ai/openspec`): `openspec list`, `openspec validate <id>`,
`openspec archive <id>` work on this folder as is.

## 2. Backend rules (backend/, Django + DRF)

Each business app in `apps/<name>/` has the same files:

| File | Contains | Must not |
|---|---|---|
| `models.py` | tables, choices, constants like `TRANSITIONS` | call services |
| `services.py` | **all writes and business rules**; plain functions `thing_create(*, actor, **fields)`; `@transaction.atomic` | know about HTTP / request |
| `selectors.py` / `get_queryset` | reads with `select_related`/annotations | write |
| `serializers.py` | input validation + output shape | contain business rules |
| `views.py` | `ServiceModelViewSet` subclasses: set `page_key`, wire services | contain business rules |
| `tests.py` | API-level tests | — |

- Raise `apps.core.exceptions.Conflict / ValidationFailed / NotFound` from services, never DRF exceptions.
- Every viewset sets `page_key = Pages.X`. Custom `@action`s declare their action in `permission_action_map`.
- New page/resource → add it to `apps/access/registry.py` (`Pages` + `PAGES`).
- Cross-app: call the other app's **service** for writes. Dependency direction:
  `core ← access ← users ← employees ← clients ← projects ← procurement / mrp / production`.
  The hub (`projects`) never imports the apps that hang off it.
- Business records use `AuditModel` + `SoftDeleteModel`. Money is `DecimalField(18,2)`.
- Human codes come from the PK after the first save: `MJ-00001`, `XD-0001`, `LY-26-00001`.
- After model changes: `uv run python manage.py makemigrations <app> -n <what>` and read the file.

## 3. Frontend rules (frontend/) — house style = uzbridge (ADR 0006)

- Pages in `src/modules/<name>/`: `api.ts`, `<Name>ListPage.tsx`, `<Name>FormPage.tsx`.
- Styling is Tailwind v4 with the tokens in `src/index.css` only (`bg-surface`, `text-muted`,
  `border-line`, `bg-accent`, `bg-ok-soft text-ok`…). No raw hex colours in components, no UI library.
- Reuse `src/components/`: `ui.tsx` (Button, Field, Input, Select, Toggle, Checkbox, Segmented, Pill,
  Kpi, Smart, Dialog, Menu), `DataTable` + `Toolbar`, `SearchInput`, `EntitySelect`, `Record.tsx`
  (RecordPage, RecordNav, ActionBar, StatusTrack, Sheet, FieldGrid, Row), `Chatter`.
- A record page = `RecordPage chatter={{model, id}}` → RecordNav → ActionBar (+StatusTrack) → Sheet.
  A new model with a page gets `TRACK` on the backend and its label in `apps/chatter/views.CHATTER_PAGES`.
- Icons: lucide-react, `strokeWidth={1.75}`.
- Permission checks via `useCan(page, action)`; the backend stays the authority.
- UI text is Uzbek (Latin). Short labels; ERP users scan, they don't read.

## 4. Commits
Conventional commits: `feat(projects): …`, `fix(access): …`, `docs(openspec): …`.
Reference the change-id in the body when there is one.

# Tasks: add-chatter-and-uzbridge-design

## Backend
- [x] apps/chatter: Message model, tracking (TRACK, signals, middleware, muted, post), API, admin
- [x] TRACK on Project, Client, Employee, User, Role; role/user services post permission/role events
- [x] projects: status change → one chatter line; drop ProjectStatusLog with data migration
- [x] tests: create/track/untracked/note/permission/status comment

## Frontend
- [x] Tailwind v4 + lucide, tokens from uzbridge, Onest font, light/dark theme
- [x] UI kit: Button, Field, Input, Select, Textarea, Toggle, Checkbox, Pill, Kpi, Dialog, toast, Pager
- [x] Shell + Sidebar + TopBar in uzbridge style
- [x] DataTable, SearchInput, EntitySelect (remote combobox) rebuilt
- [x] Record page layout: breadcrumb + record pager, action bar, status track, ChatterPanel
- [x] All pages ported: login, dashboard, projects, clients, employees, users, roles
- [x] Remove Mantine

## Docs
- [x] ADR 0005, archive change, merge specs, CHANGELOG

## Verified
- 17 backend tests pass (5 new chatter tests).
- Browser: dashboard (light + dark), Loyihalar list/record, note + status change in chatter, client field change tracked, role matrix, user page, 375px phone width without horizontal scroll.

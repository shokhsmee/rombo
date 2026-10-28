# Tasks: add-chatter-and-uzbridge-design

## Backend
- [ ] apps/chatter: Message model, tracking (TRACK, signals, middleware, muted, post), API, admin
- [ ] TRACK on Project, Client, Employee, User, Role; role/user services post permission/role events
- [ ] projects: status change → one chatter line; drop ProjectStatusLog with data migration
- [ ] tests: create/track/untracked/note/permission/status comment

## Frontend
- [ ] Tailwind v4 + lucide, tokens from uzbridge, Onest font, light/dark theme
- [ ] UI kit: Button, Field, Input, Select, Textarea, Toggle, Checkbox, Pill, Kpi, Dialog, toast, Pager
- [ ] Shell + Sidebar + TopBar in uzbridge style
- [ ] DataTable, SearchInput, EntitySelect (remote combobox) rebuilt
- [ ] Record page layout: breadcrumb + record pager, action bar, status track, ChatterPanel
- [ ] All pages ported: login, dashboard, projects, clients, employees, users, roles
- [ ] Remove Mantine

## Docs
- [ ] ADR 0005, archive change, merge specs, CHANGELOG

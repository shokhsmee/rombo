# Tasks: add-crm-telephony

## Backend
- [x] Registry: `Pages.CRM`, `Pages.TELEPHONY` (group "CRM"); seed roles get them
- [x] `apps/crm` models: Pipeline, Stage, Lead, LeadTask, Call, Extension, TelephonySettings + migration
- [x] `phones.py`, `normalize.py` (generic PBX payload reader) ported from uzbridge
- [x] services: pipeline/stage, lead create/update/move/delete, tasks, convert (clients + projects services)
- [x] services: telephony ingest + rules, softphone report, link / lead from call, settings, extensions
- [x] selectors, serializers, views, urls (`/crm/`, `/telephony/`, public hook), admin
- [x] `crm.lead` in `CHATTER_PAGES`
- [x] demo data (`seed_crm_demo`, called from `seed_demo`)
- [x] tests

## Frontend
- [x] `modules/crm`: api, Voronka (kanban + list), Lid record page with tasks and chatter, stage settings
- [x] `modules/telephony`: api, Qo'ng'iroqlar, settings + extensions, softphone (`jssip@3.10.1`), call popup
- [x] Shell: "CRM" nav group after "Savdo"; live telephony mounted once
- [x] PageKey union gets `crm`, `telephony`

## Check
- [x] `uv run pytest`, `npx tsc -b && npx vite build`
- [x] Pages checked in the browser
- [x] Archive, merge spec deltas, CHANGELOG

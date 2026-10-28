# Change: add-crm-telephony

## Why
The process map starts with Marketing handing **leads** to Sotuv; Rombo had nothing before the Loyiha.
Sales keeps leads in notebooks and Telegram, and phone calls (the main channel for a window factory) leave
no trace. uzbridge already has a working CRM (voronka, lead card, tasks) and telephony (PBX webhook, call
log, browser softphone over SIP/WebRTC); this change ports it into Rombo's architecture.

## What changes
- New app **crm** (`backend/apps/crm`):
  - **Voronka**: pipelines with ordered stages (open / won / lost); a default pipeline
    (Yangi → Bog'lanildi → O'lchov → Taklif → Shartnoma → Yutildi / Rad etildi) is created on first use.
  - **Lid** (`LD-00001`): title, contact name and phone, optional linked Mijoz, manager (Xodim),
    source (= sales channel list), budget, region, address, notes; stage, status, lost reason.
    Kanban board with drag & drop, list view, filters, record page with chatter.
  - **Vazifalar** (tasks) on a lead: type (call, meeting, measurement, message, other), due time, assignee,
    done; overdue shown on the board.
  - **Konvertatsiya**: "Loyiha ochish" on a lead creates the Mijoz (or uses the linked/matched one) and a
    Loyiha through the clients / projects services, moves the lead to the won stage and links both ways.
  - **Telefoniya**: call log (`Call`) from a PBX webhook (any IP-PBX, generic payload reader ported from
    uzbridge) and from the browser softphone; calls are matched to the lead / client by phone (last 9 digits),
    written to their chatter, a missed call from an unknown number creates a lead and a call-back task.
    Live call popup for the operator; per-user extension and SIP login; global settings row (WSS address,
    SIP domain, webhook token, rules).
- Frontend: `modules/crm` (Voronka, Lid card) and `modules/telephony` (Qo'ng'iroqlar, settings, softphone
  on `jssip@3.10.1`, call popup). New "CRM" nav group after "Savdo".
- Page keys `crm` and `telephony` (group "CRM").

## Impact
- Apps: new `crm`; `access` (registry), `chatter` (CHATTER_PAGES), `core` (seed roles, demo data).
  `clients` / `projects` are called through their services and do not import `crm`.
- Tables: `crm_pipeline`, `crm_stage`, `crm_lead`, `crm_leadtask`, `crm_call`, `crm_extension`,
  `crm_telephonysettings`.
- Endpoints: `/api/v1/crm/{pipelines,stages,leads,tasks}/`, `/api/v1/crm/leads/board/`,
  `/api/v1/crm/leads/{id}/{move,convert}/`, `/api/v1/telephony/{calls,extensions,settings,me,softphone}/`,
  public `/api/v1/telephony/hook/{token}/`.
- Pages: `/crm`, `/crm/leads/:id`, `/telephony`, `/telephony/settings`; softphone + popup on every page.
- Frontend dependency: `jssip@3.10.1` (exact).
- Spec deltas: new `crm`, new `telephony`, modified `access-control` (two pages), `chatter` (lead history).

# Change: add-service-maintenance

## Why
After installation (O'rnatish) the company has no way to take care of a client: a window that doesn't close, a
broken handle, a cracked glass or a mosquito net is reported by phone and handed to a master (usta) by word of
mouth. Nobody sees how many calls are open, who is on which job, whether warranty covers it, or whether the
client was happy. Masters work in the field from a phone; clients live in Telegram.

## What changes
- **New app `maintenance`** (Servis, group "Servis" in the menu):
  - **Usta** (master): name, phone, region, skills, optional link to an Employee, active flag; code `US-0001`.
    Linked to Telegram when the master shares the same phone in the master bot.
  - **Servis arizasi** (service request) `SV-26-00001`: client, optional Loyiha (warranty), kind (rostlash,
    furnitura, oyna, maskitka, germetik, boshqa), description, address / point, preferred date, warranty flag,
    price, master, scheduled time, photos (before / after), master's report, client's rating and feedback.
  - Status flow: `new → assigned → accepted → in_progress → done → closed`, `cancelled` from any open status;
    a master can decline an assigned job (back to `new`). Rules live in `TRANSITIONS`.
- **Two Telegram bots** (Bot API over HTTPS, tokens in env):
  - **Mijoz bot** — /start → share phone → linked to the client with that phone (or a new client). Opens the
    client Mini App; gets messages when a master is assigned, is on the way, finished; asked to rate.
  - **Usta bot** — /start → share phone → linked to the active master with that phone (unknown numbers are
    refused). New jobs arrive with Qabul qilish / Rad etish buttons and a Mini App button.
  - Updates come by webhook (`/api/v1/maintenance/bot/<kind>/webhook/`, secret header) or by
    `manage.py service_bots` (long polling) for development and servers without HTTPS.
- **Two Mini Apps** (one Vite entry `/app/`, React):
  - client: my requests with status, new request (kind, description, photos, address, location), detail with
    master and timeline, rate a finished job, cancel a new one;
  - master: today / active / history, job detail with client phone and map link, accept / decline / start /
    finish with report and after-photos.
  - Authenticated by Telegram `initData` (HMAC with the bot token), never by ERP login.
- **ERP pages**: Servis arizalari (list + record with assign, status, chatter) and Ustalar (list + form).

## Impact
- Apps: new `apps/maintenance` (models, services, bot, webapp auth, views, tests, migration 0001).
- Access: pages `service_requests`, `service_masters` (group "Servis"); Administrator gets full access.
- Env: `SERVICE_CLIENT_BOT_TOKEN`, `SERVICE_MASTER_BOT_TOKEN`, `SERVICE_WEBHOOK_SECRET`; Mini App URL from
  `PUBLIC_BASE_URL` (Telegram requires HTTPS).
- Frontend: `src/modules/maintenance/` (ERP), `miniapp.html` + `src/miniapp/` (Mini Apps), nginx `/app/`.
- Deploy: compose service `bots` (`manage.py service_bots`), systemd unit.

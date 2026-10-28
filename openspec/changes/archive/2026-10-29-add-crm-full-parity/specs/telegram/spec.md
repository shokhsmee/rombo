## ADDED Requirements

### Requirement: Telegram accounts
An employee SHALL connect their own Telegram account (a user account over MTProto, Telethon): phone → code →
optional 2FA password. API ID / Hash come from env TELEGRAM_API_ID / TELEGRAM_API_HASH or the account's own. The
session is encrypted at rest. Only the owner changes or uses an account; someone with `telegram.update` sees every
account and can disconnect or delete it, never read its chats. Page key `telegram`, group "CRM".

#### Scenario: 2FA
- WHEN the code is right and the account has a cloud password
- THEN the answer says `need_password` and signing in finishes with the password

### Requirement: Chats without stored messages
Chats SHALL be stored as metadata only (peer, name, phone, unread, read marks, small avatar, client, lead). Message
text and files SHALL never be stored: they are read live from Telegram and pushed to the owner's browser.

#### Scenario: Nothing leaks
- WHEN a message arrives and is shown
- THEN its text is in no table

### Requirement: Private chat → client and lead
A first incoming message in a private chat SHALL link the chat to the client with that number, or create one when
the account says so; when the account has "lead" on, the number's open lead is linked or a new lead
("Telegram orqali yozdi") is made. The chat page can link a client by hand or open a lead.

### Requirement: Listener
`manage.py telegram_listen` SHALL keep one live connection per connected account, deliver new / edited / deleted /
read messages and reactions live, and — with REDIS_URL — serve the web app's Telegram calls so a session never has two
live connections; without it the web app opens a short-lived connection.

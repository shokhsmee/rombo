"""The kinds of connection and the form each one needs (uzbridge crm/catalog.py). The settings page is drawn
from this; services split a form into public `config` and encrypted `secrets` by the `secret` flag.

Field types: text, url, password, select (options), pipeline, stage, user (an employee), bool.
"""


def f(key, label, type="text", **kw) -> dict:
    return {"key": key, "label": label, "type": type, **kw}


_SIP = [
    f("sip_wss", "SIP WebSocket (brauzer telefoni)", "url", placeholder="wss://pbx.rombo.uz:8089/ws", advanced=True),
    f("sip_domain", "SIP domen", placeholder="pbx.rombo.uz", advanced=True),
]
_NUMBERS = f("numbers", "Kompaniya raqamlari", placeholder="+998 66 200 00 00, …",
             help="Kompaniyaning o'z liniyalari: ular hech qachon mijoz deb olinmaydi")
_REST = [
    f("base_url", "API manzili", "url", placeholder="https://api.example.uz", advanced=True),
    f("auth_mode", "Avtorizatsiya", "select", advanced=True, default="bearer",
      options=[["bearer", "Bearer token"], ["header", "Header kalit"], ["query", "URL parametri"],
               ["basic", "Login / parol"]]),
    f("api_key", "API kalit", "password", secret=True, advanced=True),
    f("login", "Login", advanced=True),
    f("password", "Parol", "password", secret=True, advanced=True),
    f("key_name", "Kalit nomi", advanced=True, placeholder="X-API-Key"),
    f("from_param", "«Dan» parametri", advanced=True, default="date_from"),
    f("to_param", "«Gacha» parametri", advanced=True, default="date_to"),
]
_LEADS = [
    f("source", "Manba nomi (lidda)", placeholder="Sayt"),
    f("duplicate", "Takroriy murojaat", "select", default="open_lead",
      options=[["open_lead", "Ochiq lidiga yozish"], ["always_new", "Har safar yangi lid"]]),
    f("pipeline_id", "Voronka", "pipeline"),
    f("stage_id", "Bosqich", "stage"),
    f("manager_id", "Mas'ul", "user", help="Bo'sh — taqsimlash (yoqilgan bo'lsa) tanlaydi"),
    f("tags", "Teglar", placeholder="sayt, aksiya"),
]

KINDS = [
    {
        "kind": "utel", "group": "telephony", "name": "UTeL", "webhook": "telephony",
        "tagline": "UTeL bulutli ATS: qo'ng'iroqlar real vaqtda, tarix va yozuvlar",
        "howto": ("UTeL kabinetida Modullar → Webhook: quyidagi manzilni qo'ying va call_started, dial_answered, "
                  "call_ended, call_saved hodisalarini belgilang. Tarixni olish uchun UTeL manzili, email va parol."),
        "fields": [
            f("base_url", "UTeL manzili", "url", placeholder="https://api.cc123.utel.uz",
              help="Webhook'dagi «domain» qiymati"),
            f("login", "UTeL email"),
            f("password", "UTeL parol", "password", secret=True),
            f("api_key", "API token", "password", secret=True, advanced=True,
              help="Bo'sh — email va paroldan olinadi"),
            _NUMBERS, *_SIP,
        ],
    },
    {
        "kind": "moizvonki", "group": "telephony", "name": "Moi Zvonki", "webhook": "telephony",
        "tagline": "Xodimlarning o'z mobil telefonlaridagi qo'ng'iroqlar",
        "howto": ("Domen, administrator emaili va API kaliti (Moi Zvonki → Sozlamalar → API) kiritilsa, webhook "
                  "avtomatik ulanadi. Xodimlar Telefoniya → Ichki raqamlar'da o'z emaili va API kaliti bilan "
                  "qo'shiladi (click-to-call uchun)."),
        "fields": [
            f("domain", "Domen", placeholder="kompaniya.moizvonki.ru"),
            f("login", "Administrator email"),
            f("api_key", "API kalit", "password", secret=True),
            _NUMBERS,
        ],
    },
    {
        "kind": "pbx", "group": "telephony", "name": "IP-telefoniya (PBX)", "webhook": "telephony",
        "tagline": "Istalgan IP-ATS (Asterisk, FreePBX, 3CX…): hodisalarni webhook'ga yuboradi",
        "howto": ("ATS qo'ng'iroq hodisalarini (ringing / answer / hangup) quyidagi manzilga POST qiladi: "
                  "call_id, from, to, direction, billsec, disposition, recording_url — umumiy nomlar tanib olinadi."),
        "fields": [
            _NUMBERS, *_SIP, *_REST,
            f("history_path", "Tarix yo'li", advanced=True, placeholder="/calls"),
            f("originate_path", "Click-to-call yo'li", advanced=True, placeholder="/originate"),
        ],
    },
    {
        "kind": "webhook", "group": "leads", "name": "Sayt / forma", "webhook": "leads",
        "tagline": "Saytdagi forma, Facebook / Instagram reklama formasi, Tilda va boshqalar",
        "howto": ("Forma ma'lumotlarini (name, phone, email, message va boshqa maydonlar) quyidagi manzilga POST "
                  "qiling — JSON yoki oddiy forma. Bir xil `id` qayta kelsa — takror lid ochilmaydi."),
        "fields": _LEADS,
    },
    {
        "kind": "yuboraman", "group": "leads", "name": "Yuboraman", "webhook": "leads",
        "tagline": "Yuboraman arizalari to'g'ridan-to'g'ri voronkaga",
        "howto": "Yuboraman'dagi «Webhook» maydoniga quyidagi manzilni qo'ying — API kalit kerak emas.",
        "fields": [*_LEADS, *_REST, f("leads_path", "Arizalar yo'li", advanced=True, placeholder="/leads")],
    },
    {
        "kind": "amocrm", "group": "leads", "name": "amoCRM", "webhook": "amocrm",
        "tagline": "amoCRM bitimlari va kontaktlari Rombo lidlariga",
        "howto": ("amoCRM → Sozlamalar → Integratsiyalar → «Integratsiya yaratish» (xususiy). Redirect URL: "
                  "quyidagi manzil. «Kalitlar va ruxsatlar»dan secret key, integration ID va avtorizatsiya kodini "
                  "(20 daqiqa amal qiladi) shu yerga kiriting. Bitimlar har 10 daqiqada va amoCRM webhook'ida olinadi."),
        "fields": [
            f("host", "amoCRM manzili", placeholder="kompaniya.amocrm.ru"),
            f("client_id", "Integration ID"),
            f("client_secret", "Secret key", "password", secret=True),
            f("code", "Avtorizatsiya kodi", "password", secret=True, transient=True,
              help="Ulanish uchun bir marta; saqlanmaydi"),
            f("pipeline_id", "Rombo voronkasi", "pipeline"),
            f("manager_id", "Mas'ul (agar amoCRM'dagi xodim topilmasa)", "user"),
            f("source", "Manba nomi (lidda)", placeholder="amoCRM"),
        ],
    },
]

KIND_BY_KEY = {k["kind"]: k for k in KINDS}


def secret_keys(kind: str) -> set[str]:
    return {x["key"] for x in KIND_BY_KEY[kind]["fields"] if x.get("secret") and not x.get("transient")}


def public_keys(kind: str) -> set[str]:
    return {x["key"] for x in KIND_BY_KEY[kind]["fields"] if not x.get("secret")}


def defaults(kind: str) -> dict:
    return {x["key"]: x["default"] for x in KIND_BY_KEY[kind]["fields"] if "default" in x and not x.get("secret")}

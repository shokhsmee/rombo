"""Google OAuth (scope drive.file) and Drive v3 over plain httpx (uzbridge realty/google.py + crm/recordings.py).

The OAuth app comes from env GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET; the account's tokens are stored
encrypted by the service (crm.GoogleAccount).
"""

import base64
import json
import mimetypes
import tempfile
from pathlib import Path

import httpx
from django.conf import settings

from apps.crm.providers import http
from apps.crm.providers.http import ProviderError

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
DRIVE = "https://www.googleapis.com/drive/v3"
UPLOAD = "https://www.googleapis.com/upload/drive/v3/files"
SCOPE = "openid email https://www.googleapis.com/auth/drive.file"
DRIVE_TIMEOUT = httpx.Timeout(60.0, connect=10.0)
DOWNLOAD_TIMEOUT = httpx.Timeout(120.0, connect=10.0)
MAX_BYTES = 100 * 1024 * 1024


class GoogleError(ProviderError):
    pass


class GoogleGone(GoogleError):
    """The refresh token was revoked: the account has to be connected again."""


class NotReady(ProviderError):
    """The PBX hasn't finished the recording yet: try again later."""


def configured() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def auth_url(redirect_uri: str, state: str) -> str:
    q = httpx.QueryParams({
        "client_id": settings.GOOGLE_CLIENT_ID, "redirect_uri": redirect_uri, "response_type": "code",
        "scope": SCOPE, "access_type": "offline", "prompt": "consent", "include_granted_scopes": "true",
        "state": state,
    })
    return f"{AUTH_URL}?{q}"


def _token(data: dict) -> dict:
    try:
        r = http.request("POST", TOKEN_URL, data={**data, "client_id": settings.GOOGLE_CLIENT_ID,
                                                   "client_secret": settings.GOOGLE_CLIENT_SECRET})
    except httpx.HTTPError as exc:
        raise GoogleError(f"Google'ga ulanib bo'lmadi: {exc.__class__.__name__}") from exc
    body = r.json() if r.content else {}
    if r.status_code != 200:
        if body.get("error") == "invalid_grant":
            raise GoogleGone("Google ruxsati bekor qilingan — qayta ulang")
        raise GoogleError(f"Google token bermadi ({r.status_code}): {body.get('error_description') or r.text[:200]}")
    return body


def exchange(code: str, redirect_uri: str) -> dict:
    """{access_token, refresh_token, expires_in, email}; refuses when drive.file wasn't granted."""
    body = _token({"code": code, "redirect_uri": redirect_uri, "grant_type": "authorization_code"})
    if "drive.file" not in body.get("scope", ""):
        raise GoogleError("Google Drive'ga ruxsat berilmadi — qayta ulab, Drive'ga belgini qo'ying")
    if not body.get("refresh_token"):
        raise GoogleError("Google refresh token bermadi — qayta ulang")
    return {**body, "email": _email(body.get("id_token", ""))}


def refresh(refresh_token: str) -> dict:
    return _token({"refresh_token": refresh_token, "grant_type": "refresh_token"})


def _email(id_token: str) -> str:
    """The email inside the id_token (it came straight from Google over TLS: no signature check needed)."""
    try:
        part = id_token.split(".")[1]
        return str(json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))).get("email") or "")
    except (IndexError, ValueError):
        return ""


def _drive(method: str, url: str, token: str, **kw) -> httpx.Response:
    try:
        r = http.request(method, url, headers={"Authorization": f"Bearer {token}"}, timeout=DRIVE_TIMEOUT, **kw)
    except httpx.HTTPError as exc:
        raise GoogleError(f"Google Drive'ga ulanib bo'lmadi: {exc.__class__.__name__}") from exc
    if r.status_code == 404:
        raise GoogleError("folder-gone")
    if r.status_code >= 400:
        try:
            msg = r.json()["error"]["message"]
        except (ValueError, KeyError, TypeError):
            msg = r.text[:200]
        raise GoogleError(f"Google Drive {r.status_code}: {msg}")
    return r


def folder_alive(token: str, folder_id: str) -> bool:
    try:
        return not _drive("GET", f"{DRIVE}/files/{folder_id}", token, params={"fields": "id,trashed"}).json().get(
            "trashed")
    except GoogleError as e:
        if str(e) == "folder-gone":
            return False
        raise


def create_folder(token: str, name: str) -> tuple[str, str]:
    body = _drive("POST", f"{DRIVE}/files", token, params={"fields": "id,webViewLink"},
                  json={"name": name, "mimeType": "application/vnd.google-apps.folder"}).json()
    return body["id"], body.get("webViewLink", "")


def upload(token: str, folder_id: str, name: str, mime: str, path: Path) -> str:
    meta = json.dumps({"name": name, "parents": [folder_id], "mimeType": mime})
    with open(path, "rb") as f:
        files = {"metadata": ("metadata", meta, "application/json; charset=UTF-8"), "file": (name, f, mime)}
        r = _drive("POST", UPLOAD, token, params={"uploadType": "multipart", "fields": "id"}, files=files)
    return r.json()["id"]


def download(url: str, headers: dict | None = None) -> tuple[Path, str]:
    """The provider's recording into a temp file → (path, mime). NotReady while the PBX is still writing it."""
    try:
        with http.client(timeout=DOWNLOAD_TIMEOUT, follow_redirects=True) as c, c.stream(
                "GET", url, headers=headers or {}) as r:
            if r.status_code in (404, 423, 425, 503):
                raise NotReady(f"Yozuv hali tayyor emas ({r.status_code})")
            if r.status_code >= 400:
                raise ProviderError(f"Yozuvni yuklab bo'lmadi ({r.status_code})")
            mime = r.headers.get("content-type", "").split(";")[0].strip() or "audio/mpeg"
            if mime.startswith("text/") or mime == "application/json":
                raise NotReady("PBX yozuv o'rniga matn qaytardi")
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=mimetypes.guess_extension(mime) or ".mp3")
            size = 0
            with tmp:
                for chunk in r.iter_bytes(65536):
                    size += len(chunk)
                    if size > MAX_BYTES:
                        raise ProviderError("Yozuv 100 MB dan katta")
                    tmp.write(chunk)
    except httpx.HTTPError as exc:
        raise NotReady(f"Yozuvni yuklab bo'lmadi: {exc.__class__.__name__}") from exc
    if size == 0:
        Path(tmp.name).unlink(missing_ok=True)
        raise NotReady("Yozuv bo'sh")
    return Path(tmp.name), mime


def open_media(token: str, file_id: str, range_header: str = "") -> tuple[httpx.Client, httpx.Response]:
    """A streamed Drive file (caller closes both). Range passes through so the audio player can seek."""
    c = http.client(timeout=DRIVE_TIMEOUT)
    headers = {"Authorization": f"Bearer {token}", **({"Range": range_header} if range_header else {})}
    r = c.send(c.build_request("GET", f"{DRIVE}/files/{file_id}", params={"alt": "media"}, headers=headers),
               stream=True)
    return c, r

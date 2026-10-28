"""Call recordings kept in the company's Google Drive (uzbridge crm/recordings.py + realty/google.py).

A PBX keeps recordings for a while and behind its own login; a copy in Drive stays. When a call with a
recording ends, the worker downloads it and uploads it into one folder ("Rombo · Qo'ng'iroq yozuvlari").
The player gets a signed Rombo link (12 h) that streams the Drive file (Range passes through).
Not ready yet → retried after 2, 10, 30 minutes; then the reason is kept on the call.
"""

import re
from datetime import timedelta
from pathlib import Path

from django.core import signing
from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import ValidationFailed
from apps.crm.models import Call, Connection, CrmSettings, GoogleAccount
from apps.crm.providers import google
from apps.crm.providers.http import ProviderError
from apps.crm.services.leads import crm_settings

FOLDER_NAME = "Rombo · Qo'ng'iroq yozuvlari"
STATE_SALT, STATE_MAX_AGE = "crm-google", 20 * 60
LINK_SALT, LINK_TTL = "crm-recording", 12 * 3600
RETRY_AFTER = (120, 600, 1800)

# ------------------------------------------------------------------ Google account


def redirect_uri(request=None) -> str:
    from apps.crm.services.connections import public_base

    return public_base(request) + "/api/v1/telephony/recordings/google/callback/"


def google_connect_url(*, actor, back: str = "/telephony/settings", request=None) -> str:
    if not google.configured():
        raise ValidationFailed("Google ulanmagan: serverda GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET yo'q")
    state = signing.dumps({"u": actor.pk, "r": back if back.startswith("/") else "/"}, salt=STATE_SALT)
    return google.auth_url(redirect_uri(request), state)


def google_callback(*, code: str, state: str, request=None) -> str:
    """Store the account; → the page to go back to."""
    try:
        data = signing.loads(state, salt=STATE_SALT, max_age=STATE_MAX_AGE)
    except signing.BadSignature as e:
        raise ValidationFailed("Havola eskirgan — Google'ni qaytadan ulang") from e
    tokens = google.exchange(code, redirect_uri(request))
    acc, _ = GoogleAccount.objects.get_or_create(pk=1)
    acc.email, acc.refresh_token, acc.access_token = tokens["email"], tokens["refresh_token"], tokens["access_token"]
    acc.expires_at = timezone.now() + timedelta(seconds=int(tokens.get("expires_in", 3600)) - 60)
    acc.connected_by_id = data.get("u")
    acc.save()
    return data.get("r") or "/telephony/settings"


def google_token() -> str:
    acc = GoogleAccount.objects.filter(pk=1).exclude(refresh_token="").first()
    if acc is None:
        raise google.GoogleError("Google ulanmagan")
    if acc.access_token and acc.expires_at and acc.expires_at > timezone.now():
        return acc.access_token
    try:
        body = google.refresh(acc.refresh_token)
    except google.GoogleGone:
        acc.delete()  # revoked: connect again
        CrmSettings.objects.filter(pk=1).update(recordings_enabled=False)
        raise
    acc.access_token = body["access_token"]
    acc.expires_at = timezone.now() + timedelta(seconds=int(body.get("expires_in", 3600)) - 60)
    acc.save(update_fields=["access_token", "expires_at", "connected_at"])
    return acc.access_token


def google_disconnect(*, actor) -> None:
    GoogleAccount.objects.filter(pk=1).delete()
    CrmSettings.objects.filter(pk=1).update(recordings_enabled=False)


def _ensure_folder(s: CrmSettings) -> str:
    token = google_token()
    if s.recordings_folder_id and google.folder_alive(token, s.recordings_folder_id):
        return s.recordings_folder_id
    s.recordings_folder_id, s.recordings_folder_url = google.create_folder(token, FOLDER_NAME)
    s.save(update_fields=["recordings_folder_id", "recordings_folder_url"])
    return s.recordings_folder_id


def recordings_switch(*, actor, enabled: bool) -> CrmSettings:
    """On: the folder is made (or found) and only calls from now on are copied. Off: nothing new is copied."""
    s = crm_settings()
    if enabled:
        try:
            _ensure_folder(s)
        except ProviderError as e:
            raise ValidationFailed(str(e)) from e
        s.recordings_since = timezone.now()
    s.recordings_enabled = enabled
    s.save(update_fields=["recordings_enabled", "recordings_since"])
    return s


# ------------------------------------------------------------------ archiving


def recording_wanted(call: Call) -> bool:
    s = crm_settings()
    return bool(call.recording_url and not call.recording_file_id and s.recordings_enabled
                and s.recordings_folder_id and GoogleAccount.objects.filter(pk=1).exists()
                and (s.recordings_since is None or call.started_at >= s.recordings_since))


def recording_queue(call: Call) -> None:
    if recording_wanted(call):
        Call.objects.filter(pk=call.pk).update(recording_next_at=timezone.now(), recording_error="")


def _file_name(call: Call, mime: str) -> str:
    who = (call.client.name if call.client_id else "") or (call.lead.title if call.lead_id else "")
    when = timezone.localtime(call.started_at).strftime("%Y-%m-%d %H-%M")
    way = "kiruvchi" if call.direction == "in" else "chiquvchi"
    name = " · ".join(p for p in [when, call.client_phone, way, who] if p)
    ext = {"audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/ogg": ".ogg",
           "audio/mp4": ".m4a", "audio/webm": ".webm"}.get(mime, ".mp3")
    return re.sub(r'[\\/:*?"<>|]', "-", name)[:200] + ext


def archive(call: Call) -> bool:
    """Copy one recording; → True when it is in Drive. Retries and errors are written on the call."""
    headers = {}
    if call.connection_id and call.connection.kind == Connection.Kind.MOIZVONKI:
        headers["X-Api-Key"] = call.connection.get_secrets().get("api_key", "")
    path: Path | None = None
    try:
        path, mime = google.download(call.recording_url, headers)
        s = crm_settings()
        folder = _ensure_folder(s)
        file_id = google.upload(google_token(), folder, _file_name(call, mime), mime, path)
    except google.NotReady as e:
        attempt = call.recording_attempts
        if attempt < len(RETRY_AFTER):
            Call.objects.filter(pk=call.pk).update(
                recording_attempts=attempt + 1,
                recording_next_at=timezone.now() + timedelta(seconds=RETRY_AFTER[attempt]))
        else:
            Call.objects.filter(pk=call.pk).update(recording_error=str(e)[:300], recording_next_at=None)
        return False
    except ProviderError as e:
        Call.objects.filter(pk=call.pk).update(recording_error=str(e)[:300], recording_next_at=None)
        return False
    finally:
        if path is not None:
            path.unlink(missing_ok=True)
    Call.objects.filter(pk=call.pk).update(recording_file_id=file_id, recording_archived_at=timezone.now(),
                                           recording_error="", recording_next_at=None)
    return True


def archive_due(limit: int = 20) -> int:
    """crm_worker: recordings whose turn has come."""
    done = 0
    calls = (Call.objects.filter(recording_next_at__lte=timezone.now(), recording_file_id="")
             .select_related("connection", "client", "lead")[:limit])
    for c in calls:
        with transaction.atomic():
            done += int(archive(c))
    return done


# ------------------------------------------------------------------ playback


def recording_link(call: Call, request=None) -> str:
    """The provider's URL until a Drive copy exists, then a signed Rombo link (12 h)."""
    if not call.recording_file_id:
        return call.recording_url
    token = signing.dumps({"c": call.pk}, salt=LINK_SALT)
    return f"/api/v1/telephony/recordings/{token}/"


def recording_call(token: str) -> Call | None:
    try:
        data = signing.loads(token, salt=LINK_SALT, max_age=LINK_TTL)
    except signing.BadSignature:
        return None
    return Call.objects.filter(pk=data.get("c")).exclude(recording_file_id="").first()


def recordings_status() -> dict:
    s = crm_settings()
    acc = GoogleAccount.objects.filter(pk=1).first()
    since = s.recordings_since
    base = Call.objects.exclude(recording_url="")
    if since:
        base = base.filter(started_at__gte=since)
    return {
        "configured": google.configured(), "connected": acc is not None, "email": acc.email if acc else "",
        "enabled": s.recordings_enabled, "folder_url": s.recordings_folder_url, "since": since,
        "archived": Call.objects.exclude(recording_file_id="").count(),
        "pending": base.filter(recording_file_id="", recording_error="").count() if s.recordings_enabled else 0,
        "failed": base.exclude(recording_error="").count(),
        "with_recording": Call.objects.exclude(recording_url="").count(),
    }

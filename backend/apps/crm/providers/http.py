"""One place every provider request goes through. Tests set TRANSPORT to an httpx.MockTransport:
no test ever reaches the network."""

import httpx

TIMEOUT = httpx.Timeout(20.0, connect=8.0)
TRANSPORT: httpx.BaseTransport | None = None


class ProviderError(Exception):
    """A provider said no or could not be reached; the message is shown to the user as is."""


def client(timeout=TIMEOUT, **kw) -> httpx.Client:
    return httpx.Client(transport=TRANSPORT, timeout=timeout, **kw)


def request(method: str, url: str, *, timeout=TIMEOUT, **kw) -> httpx.Response:
    with client(timeout=timeout, follow_redirects=kw.pop("follow_redirects", False)) as c:
        return c.request(method, url, **kw)

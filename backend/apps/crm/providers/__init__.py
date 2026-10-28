"""HTTP clients of external services (ported from uzbridge). They talk to the outside world only; the
services decide what to store. Every request goes through providers.http, so tests swap the transport."""

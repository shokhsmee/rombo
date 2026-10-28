"""Domain errors. Services raise these; one handler in main.py maps them to HTTP.

Services must never import FastAPI's HTTPException — that keeps business logic
usable from CLI scripts, background jobs and tests.
"""


class DomainError(Exception):
    status_code = 400
    code = "domain_error"

    def __init__(self, message: str, *, field: str | None = None):
        super().__init__(message)
        self.message = message
        self.field = field


class NotFound(DomainError):
    status_code = 404
    code = "not_found"


class Conflict(DomainError):
    status_code = 409
    code = "conflict"


class ValidationFailed(DomainError):
    status_code = 422
    code = "validation_failed"


class Unauthorized(DomainError):
    status_code = 401
    code = "unauthorized"


class Forbidden(DomainError):
    status_code = 403
    code = "forbidden"

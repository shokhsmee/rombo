"""Import every module's models so SQLAlchemy and Alembic see the full schema.

New module with tables? Add its import here — Alembic autogenerate reads Base.metadata.
"""

from app.modules.access.models import Role, RolePermission, user_roles  # noqa: F401
from app.modules.clients.models import Client  # noqa: F401
from app.modules.employees.models import Employee  # noqa: F401
from app.modules.projects.models import Project, ProjectStatusLog  # noqa: F401
from app.modules.users.models import User  # noqa: F401
from app.shared.models import Base  # noqa: F401

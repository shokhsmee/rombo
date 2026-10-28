"""CRM and telephony writes, split by subject (design.md §2); `from apps.crm import services` sees them all.
Order matters: later modules import earlier ones."""
# ruff: noqa: I001

from apps.crm.services.leads import *  # noqa: F403
from apps.crm.services.extras import *  # noqa: F403
from apps.crm.services.routing import *  # noqa: F403
from apps.crm.services.telephony import *  # noqa: F403
from apps.crm.services.connections import *  # noqa: F403
from apps.crm.services.intake import *  # noqa: F403
from apps.crm.services.amocrm import *  # noqa: F403
from apps.crm.services.recordings import *  # noqa: F403
from apps.crm.services.worker import *  # noqa: F403

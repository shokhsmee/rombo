from app.modules.clients.models import Client
from app.shared.repository import BaseRepository


class ClientRepository(BaseRepository[Client]):
    model = Client
    search_fields = (Client.code, Client.name, Client.tin, Client.contact_person,
                     Client.phone, Client.phone_extra, Client.region)
    sort_fields = {
        "code": Client.code,
        "name": Client.name,
        "region": Client.region,
        "created_at": Client.created_at,
    }
    default_sort = "-created_at"
    not_found_msg = "Mijoz topilmadi"

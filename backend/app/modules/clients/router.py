from typing import Annotated

from fastapi import APIRouter, Depends

from app.modules.access.registry import Action, Pages
from app.modules.auth.dependencies import DB, require
from app.modules.clients.models import ClientKind
from app.modules.clients.schemas import ClientCreate, ClientListItem, ClientOut, ClientUpdate
from app.modules.clients.service import ClientService
from app.modules.users.models import User
from app.shared.schemas import ListParams, Page

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("", response_model=Page[ClientListItem])
def list_clients(db: DB, params: Annotated[ListParams, Depends()],
                 kind: ClientKind | None = None, region: str | None = None,
                 is_active: bool | None = None, manager_id: int | None = None,
                 _: User = Depends(require(Pages.CLIENTS))):
    items, total = ClientService(db).list(params, kind=kind, region=region,
                                          is_active=is_active, manager_id=manager_id)
    return Page(items=items, total=total, page=params.page, size=params.size)


@router.get("/{client_id}", response_model=ClientOut)
def get_client(client_id: int, db: DB, _: User = Depends(require(Pages.CLIENTS))):
    return ClientService(db).get(client_id)


@router.post("", response_model=ClientOut, status_code=201)
def create_client(body: ClientCreate, db: DB, actor: User = Depends(require(Pages.CLIENTS, Action.CREATE))):
    return ClientService(db, actor.id).create(body)


@router.patch("/{client_id}", response_model=ClientOut)
def update_client(client_id: int, body: ClientUpdate, db: DB,
                  actor: User = Depends(require(Pages.CLIENTS, Action.UPDATE))):
    return ClientService(db, actor.id).update(client_id, body)


@router.delete("/{client_id}", status_code=204)
def delete_client(client_id: int, db: DB, actor: User = Depends(require(Pages.CLIENTS, Action.DELETE))):
    ClientService(db, actor.id).delete(client_id)

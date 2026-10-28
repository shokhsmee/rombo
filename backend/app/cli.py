"""Admin commands.

    uv run python -m app.cli seed        # first superuser + default roles (idempotent)
    uv run python -m app.cli demo        # sample clients/employees/projects for local dev
"""

import sys
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select

import app.models  # noqa: F401
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.modules.access.models import Role, RolePermission
from app.modules.access.registry import Pages
from app.modules.clients.models import Client, ClientKind
from app.modules.employees.models import Employee
from app.modules.projects.models import Project, ProjectStatusLog
from app.modules.users.models import User

FULL = dict(can_view=True, can_create=True, can_update=True, can_delete=True)
EDIT = dict(can_view=True, can_create=True, can_update=True)
VIEW = dict(can_view=True)

DEFAULT_ROLES = {
    "Administrator": ("Barcha sahifalarga to'liq ruxsat", {
        Pages.DASHBOARD: VIEW, Pages.PROJECTS: FULL, Pages.CLIENTS: FULL, Pages.EMPLOYEES: FULL,
        Pages.USERS: FULL, Pages.ROLES: FULL, Pages.PROCUREMENT: FULL, Pages.MRP: FULL,
    }),
    "Savdo menejeri": ("Loyiha va mijozlar bilan ishlaydi", {
        Pages.DASHBOARD: VIEW, Pages.PROJECTS: EDIT, Pages.CLIENTS: EDIT, Pages.EMPLOYEES: VIEW,
    }),
    "Ta'minotchi": ("Xaridlar bo'limi", {
        Pages.DASHBOARD: VIEW, Pages.PROJECTS: VIEW, Pages.PROCUREMENT: EDIT,
    }),
}


def seed() -> None:
    with SessionLocal() as db:
        for name, (desc, perms) in DEFAULT_ROLES.items():
            if db.scalar(select(Role).where(Role.name == name)):
                continue
            db.add(Role(name=name, description=desc, is_system=True,
                        permissions=[RolePermission(page_key=k, **v) for k, v in perms.items()]))
        if not db.scalar(select(User).where(User.username == settings.seed_admin_username)):
            db.add(User(username=settings.seed_admin_username, full_name="Tizim administratori",
                        password_hash=hash_password(settings.seed_admin_password), is_superuser=True))
        db.commit()
    print(f"seed ok — login: {settings.seed_admin_username}")


def demo() -> None:
    with SessionLocal() as db:
        if db.scalar(select(Client).limit(1)):
            print("demo data already present")
            return
        emps = [
            Employee(code="XD-0001", last_name="Karimov", first_name="Jasur", department="Savdo",
                     position="Savdo menejeri", phone="+998 90 123 45 67", hire_date=date(2023, 3, 1)),
            Employee(code="XD-0002", last_name="Rahimova", first_name="Dilnoza", department="Savdo",
                     position="Katta menejer", phone="+998 93 222 11 00", hire_date=date(2021, 9, 15)),
            Employee(code="XD-0003", last_name="Tursunov", first_name="Bekzod", department="Ta'minot",
                     position="Ta'minotchi", phone="+998 97 555 66 77", hire_date=date(2024, 1, 10)),
            Employee(code="XD-0004", last_name="Usmonov", first_name="Akmal", department="Ishlab chiqarish",
                     position="Sex boshlig'i", phone="+998 99 700 80 90", hire_date=date(2019, 5, 20)),
        ]
        db.add_all(emps)
        db.flush()
        clients = [
            Client(code="MJ-00001", kind=ClientKind.COMPANY, name="Mega Qurilish MChJ", tin="305123456",
                   contact_person="Aziz Qodirov", phone="+998 71 200 30 40", region="Toshkent sh.",
                   manager_id=emps[0].id),
            Client(code="MJ-00002", kind=ClientKind.INDIVIDUAL, name="Shoxruh Aliyev",
                   phone="+998 90 987 65 43", region="Toshkent vil.", manager_id=emps[1].id),
            Client(code="MJ-00003", kind=ClientKind.DEALER, name="Samarqand Oyna Servis", tin="207654321",
                   contact_person="Olim Saidov", phone="+998 66 233 44 55", region="Samarqand",
                   manager_id=emps[0].id),
            Client(code="MJ-00004", kind=ClientKind.COMPANY, name="Golden House Development", tin="309887766",
                   contact_person="Nodira Ismoilova", phone="+998 71 150 00 00", region="Toshkent sh.",
                   manager_id=emps[1].id),
        ]
        db.add_all(clients)
        db.flush()
        today = date.today()
        rows = [
            ("Turar-joy majmuasi, 3-blok derazalar", 3, "production", 45, "1280000000"),
            ("Xususiy uy — eshik va derazalar", 1, "confirmed", 20, "38500000"),
            ("Diler buyurtmasi, oktyabr", 2, "procurement", 12, "214000000"),
            ("Ofis binosi fasad oynalari", 0, "draft", 60, "560000000"),
            ("Kottej, alyumin vitraj", 1, "delivered", -5, "72000000"),
        ]
        for i, (name, ci, status, days, amount) in enumerate(rows, start=1):
            p = Project(code=f"LY-{today:%y}-{i:05d}", name=name, client_id=clients[ci].id,
                        manager_id=clients[ci].manager_id, status=status,
                        deadline=today + timedelta(days=days), amount=Decimal(amount),
                        region=clients[ci].region)
            db.add(p)
            db.flush()
            db.add(ProjectStatusLog(project_id=p.id, to_status="draft", comment="Loyiha yaratildi"))
            if status != "draft":
                db.add(ProjectStatusLog(project_id=p.id, from_status="draft", to_status=status))
        db.commit()
    print("demo data created")


if __name__ == "__main__":
    commands = {"seed": seed, "demo": demo}
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd not in commands:
        sys.exit(f"usage: python -m app.cli [{'|'.join(commands)}]")
    commands[cmd]()

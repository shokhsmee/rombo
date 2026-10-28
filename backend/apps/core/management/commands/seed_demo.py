from datetime import date, timedelta
from decimal import Decimal

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.clients.models import Client, ClientKind
from apps.clients.services import client_create
from apps.employees.services import employee_create
from apps.projects.services import project_change_status, project_create
from apps.references.models import RefItem
from apps.users.models import User


class Command(BaseCommand):
    help = "Sample employees, clients and Loyihalar for local development."

    @transaction.atomic
    def handle(self, *args, **options):
        if Client.all_objects.exists():
            self.stdout.write("demo data already present")
            return
        actor = User.objects.filter(is_superuser=True).first()

        emps = [
            employee_create(actor=actor, last_name="Karimov", first_name="Jasur", department="Savdo",
                            position="Savdo menejeri", phone="+998 90 123 45 67", hire_date=date(2023, 3, 1)),
            employee_create(actor=actor, last_name="Rahimova", first_name="Dilnoza", department="Savdo",
                            position="Katta menejer", phone="+998 93 222 11 00", hire_date=date(2021, 9, 15)),
            employee_create(actor=actor, last_name="Tursunov", first_name="Bekzod", department="Ta'minot",
                            position="Ta'minotchi", phone="+998 97 555 66 77", hire_date=date(2024, 1, 10)),
            employee_create(actor=actor, last_name="Usmonov", first_name="Akmal",
                            department="Ishlab chiqarish", position="Sex boshlig'i",
                            phone="+998 99 700 80 90", hire_date=date(2019, 5, 20)),
            employee_create(actor=actor, last_name="Saidova", first_name="Malika", department="Buxgalteriya",
                            position="Bosh hisobchi", phone="+998 90 410 20 30", hire_date=date(2020, 2, 3),
                            status="on_leave"),
        ]
        ref = {(r.kind, r.name): r for r in RefItem.objects.all()}
        seg = {n: ref[("client_segment", n)] for n in ("Ekonom", "Standart", "Premium", "VIP")}

        def pt(lat: str, lng: str) -> dict:
            return {"latitude": Decimal(lat), "longitude": Decimal(lng)}

        clients = [
            client_create(actor=actor, kind=ClientKind.COMPANY, name="Mega Qurilish MChJ", tin="305123456",
                          contact_person="Aziz Qodirov", phone="+998 71 200 30 40", region="Toshkent sh.",
                          manager=emps[0], segment=seg["Premium"], **pt("41.285600", "69.204500")),
            client_create(actor=actor, kind=ClientKind.INDIVIDUAL, name="Shoxruh Aliyev",
                          phone="+998 90 987 65 43", region="Samarqand", manager=emps[1],
                          segment=seg["Standart"], **pt("39.670200", "66.903500")),
            client_create(actor=actor, kind=ClientKind.DEALER, name="Samarqand Oyna Servis", tin="207654321",
                          contact_person="Olim Saidov", phone="+998 66 233 44 55", region="Samarqand",
                          manager=emps[0], segment=seg["VIP"], **pt("39.658700", "66.946600")),
            client_create(actor=actor, kind=ClientKind.COMPANY, name="Golden House Development",
                          tin="309887766", contact_person="Nodira Ismoilova", phone="+998 66 150 00 00",
                          region="Samarqand", manager=emps[1], segment=seg["Premium"],
                          **pt("39.648900", "66.961100")),
            client_create(actor=actor, kind=ClientKind.INDIVIDUAL, name="Farrux Nazarov",
                          phone="+998 94 600 70 80", region="Farg'ona", manager=emps[0],
                          segment=seg["Ekonom"], **pt("40.386400", "71.786400")),
            # more Samarqand points so the map has something to group; one without a pin
            client_create(actor=actor, kind=ClientKind.INDIVIDUAL, name="Dilshod Rahimov",
                          phone="+998 91 540 12 34", region="Samarqand", manager=emps[1],
                          segment=seg["Ekonom"], **pt("39.633800", "66.986700")),
            client_create(actor=actor, kind=ClientKind.INDIVIDUAL, name="Sardor Qobilov",
                          phone="+998 97 911 22 44", region="Samarqand", manager=emps[0],
                          segment=seg["Standart"], **pt("39.661900", "66.931200")),
            client_create(actor=actor, kind=ClientKind.COMPANY, name="Urgut Savdo Markazi MChJ",
                          tin="301556677", contact_person="Bahrom Jo'rayev", phone="+998 66 452 10 10",
                          region="Samarqand", manager=emps[1], segment=seg["Standart"],
                          **pt("39.402200", "67.243100")),
            client_create(actor=actor, kind=ClientKind.DEALER, name="Kattaqo'rg'on Deraza", tin="208112233",
                          contact_person="Ulug'bek Hamroyev", phone="+998 66 455 30 30", region="Samarqand",
                          manager=emps[0], segment=seg["Premium"], **pt("39.898900", "66.256100")),
            client_create(actor=actor, kind=ClientKind.INDIVIDUAL, name="Malika Yusupova",
                          phone="+998 93 330 44 55", region="Samarqand", manager=emps[1]),
        ]
        today = date.today()
        plan = [
            ("Turar-joy majmuasi, 3-blok derazalar", 3, ["confirmed", "production"], 45, "1280000000"),
            ("Xususiy uy — eshik va derazalar", 1, ["confirmed"], 20, "38500000"),
            ("Diler buyurtmasi, oktyabr", 2, ["confirmed", "procurement"], 12, "214000000"),
            ("Ofis binosi fasad oynalari", 0, [], 60, "560000000"),
            ("Kottej, alyumin vitraj", 1, ["confirmed", "production", "ready", "delivered"], -5, "72000000"),
            ("Maktab binosi derazalari", 4, ["confirmed", "procurement"], -3, "148000000"),
        ]
        types = [ref[("product_type", n)] for n in ("Termo", "PVX", "Novation", "Aldoks")]
        channels = [ref[("sales_channel", n)] for n in ("Salon / do'kon", "Diler", "Tavsiya", "Instagram / Telegram")]
        for i, (name, ci, steps, days, amount) in enumerate(plan):
            c = clients[ci]
            total = Decimal(amount)
            p = project_create(
                actor=actor, name=name, client=c, manager=c.manager, region=c.region, phone=c.phone,
                deadline=today + timedelta(days=days), sale_date=today - timedelta(days=30 - i * 4),
                amount=total, service_amount=(total * Decimal("0.08")).quantize(Decimal("1000")),
                advance_amount=(total * Decimal("0.4")).quantize(Decimal("1000")),
                sales_channel=channels[i % len(channels)], brand=ref[("brand", "Akfa")],
                product_name="Akfa Termo 70 / PVX Classic", mosquito_net=i % 2 == 0, dismantling=i % 3 == 0,
                partner=clients[2] if ci != 2 else None,
                items=[{"product_type": types[i % 4], "area_m2": Decimal(18 + i * 7), "quantity": 4 + i},
                       {"product_type": types[(i + 1) % 4], "area_m2": Decimal("6.5"), "quantity": 2}],
            )
            for s in steps:
                p = project_change_status(p, actor=actor, status=s)
        self.stdout.write(self.style.SUCCESS("demo data created"))
        call_command("seed_crm_demo")

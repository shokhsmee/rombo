from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.crm import services
from apps.crm.models import Lead
from apps.employees.models import Employee
from apps.references.models import RefItem
from apps.users.models import User


class Command(BaseCommand):
    help = "Sample leads, tasks and calls for local development (after seed_demo)."

    @transaction.atomic
    def handle(self, *args, **options):
        if Lead.all_objects.exists():
            self.stdout.write("crm demo data already present")
            return
        actor = User.objects.filter(is_superuser=True).first()
        managers = list(Employee.objects.filter(department="Savdo")[:2]) or [None]
        channels = {r.name: r for r in RefItem.objects.filter(kind="sales_channel")}
        p = services.default_pipeline()
        stages = list(p.stages.all())
        now = timezone.now()
        plan = [
            # title, contact, phone, stage index, budget, channel, task (kind, hours from now)
            ("3 xonali kvartira derazalari", "Sardor Yusupov", "+998 91 300 11 22", 0, "18000000",
             "Instagram / Telegram", ("Qo'ng'iroq", 1)),
            ("Hovli uy — eshik va 6 deraza", "Gulnora Ergasheva", "+998 93 450 66 77", 1, "42000000",
             "Tavsiya", ("O'lchov", 26)),
            ("Do'kon vitrinasi", "Rustam Aliev", "+998 90 777 12 34", 2, "65000000", "Salon / do'kon",
             ("O'lchov", -3)),
            ("Kottej, alyumin fasad", "Nodir Hamidov", "+998 97 120 45 45", 3, "180000000", "Diler",
             ("Uchrashuv", 48)),
            ("Balkon oynasi", "Madina Qosimova", "+998 99 811 90 90", 0, "7500000", "Instagram / Telegram", None),
            ("Maktab ta'mirlash, 40 deraza", "Shahar maktabi №12", "+998 66 233 10 10", 4, "320000000", "Tavsiya",
             ("Qo'ng'iroq", 4)),
        ]
        for i, (title, contact, phone, si, budget, channel, task) in enumerate(plan):
            lead = services.lead_create(actor=actor, stage=stages[si], title=title, contact_name=contact, phone=phone,
                                        budget=Decimal(budget), source=channels.get(channel), region="Samarqand",
                                        manager=managers[i % len(managers)])
            if task:
                services.task_create(actor=actor, lead=lead, kind=task[0], due_at=now + timedelta(hours=task[1]))
        lost = services.lead_create(actor=actor, title="Plastik eshik", contact_name="Jamshid", phone="+998 94 100 20 30")
        services.lead_move(lost, actor=actor, stage=p.stages.get(is_lost=True), lost_reason="Qimmat")

        # a generic PBX connection (no secrets: it only receives webhooks), a form source, two lead fields
        pbx = services.connection_create(actor=actor, kind="pbx", name="IP-telefoniya", config={"numbers": "+998 66 233 00 00"})
        services.connection_create(actor=actor, kind="webhook", name="Sayt", config={"source": "Sayt", "tags": "sayt"})
        services.field_create(actor=actor, label="Xonalar soni", type="number", section="deal")
        services.field_create(actor=actor, label="Profil rangi", type="select", section="extra",
                              options=["Oq", "Jigarrang", "Antratsit"])
        services.extension_create(actor=actor, user=actor, number="101", connection=pbx)  # the admin answers 101
        # calls: a missed one from a new number (makes a lead), an answered one with a known lead
        services.ingest(conn=pbx, payload={"call_id": "demo-1", "from": "+998935550011", "to": "101", "event": "hangup",
                         "start": (now - timedelta(minutes=40)).isoformat()})
        services.ingest(conn=pbx, payload={"call_id": "demo-2", "from": "+998913001122", "to": "101", "event": "hangup", "billsec": 154,
                         "start": (now - timedelta(minutes=20)).isoformat()})
        services.ingest(conn=pbx, payload={"call_id": "demo-3", "direction": "out", "from": "101", "to": "+998934506677",
                         "billsec": 63, "start": (now - timedelta(minutes=5)).isoformat()})
        self.stdout.write(self.style.SUCCESS("crm demo data created"))

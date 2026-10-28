"""Record history, Odoo-chatter style (ported from uzbridge). See ADR 0005.

Opt a model in:

    class Project(...):
        TRACK = {"status": "Holat", "deadline": "Muddat"}
        CHATTER_NAME = "Loyiha"        # "Loyiha yaratildi"

Write a line yourself:   from apps.chatter.services import post, event, muted
"""

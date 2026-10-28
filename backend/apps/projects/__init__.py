"""Loyihalar — customer orders. The hub every other module attaches to.

Procurement requests, MRP runs, production jobs, deliveries and payments will all
carry a FK to Project. Keep this app free of imports from those apps: they depend
on projects, never the reverse.
"""

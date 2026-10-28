"""Loyihalar — customer orders. The hub every other module attaches to.

Procurement requests, MRP runs, production jobs, deliveries and payments will
all carry `project_id`. Keep this module free of imports from those modules;
they depend on projects, never the reverse.
"""

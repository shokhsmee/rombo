# Tasks

- [x] Scan all ModelSerializers for writable workflow fields (status, posted_at, sent_*, source_*, …)
- [x] Mark them read-only; keep legitimate ones (employee status, lead source, account code)
- [x] Receipt: refuse a changed order; refuse duplicate order lines
- [x] Superuser guard in user create / update / reset password
- [x] `select_for_update(of=("self",))` everywhere (PostgreSQL)
- [x] Tests: `procurement/tests.py::test_workflow_fields_are_not_writable`, duplicate lines in
      `test_receipt_prefills_remaining_and_refuses_over_receipt`,
      `access/tests.py::test_users_editor_cannot_become_or_touch_a_superuser`
- [x] Full suite on PostgreSQL

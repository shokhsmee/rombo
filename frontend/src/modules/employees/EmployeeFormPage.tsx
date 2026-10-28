import { useNavigate, useParams } from "react-router-dom";

import { useAuth, useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { ActionBar, DeleteButton, FieldGrid, RecordNav, RecordPage, Row, SaveButtons, Sheet, SheetTitle } from "@/components/Record";
import { Input, Textarea } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { notifyError, notifyOk } from "@/lib/notify";

import { EMP_STATUS, employeesApi, useDepartments, type Employee, type EmployeeStatus } from "./api";

type Values = {
  last_name: string; first_name: string; middle_name: string; phone: string; email: string;
  department: string; position: string; hire_date: string; birth_date: string;
  status: EmployeeStatus; address: string; notes: string; user_id: number | null;
};

const EMPTY: Values = {
  last_name: "", first_name: "", middle_name: "", phone: "", email: "", department: "", position: "",
  hire_date: "", birth_date: "", status: "active", address: "", notes: "", user_id: null,
};

export function EmployeeFormPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan("employees");
  const { can: canPage } = useAuth();
  const detail = employeesApi.useDetail(isNew ? undefined : id);
  const save = employeesApi.useSave();
  const remove = employeesApi.useRemove();
  const departments = useDepartments();
  const e = detail.data;
  const editable = isNew ? can.create : can.update;

  const form = useServerForm<Values, Employee>({
    initial: EMPTY,
    record: e,
    toForm: (r) => ({
      last_name: r.last_name, first_name: r.first_name, middle_name: r.middle_name, phone: r.phone, email: r.email,
      department: r.department, position: r.position, hire_date: r.hire_date ?? "", birth_date: r.birth_date ?? "",
      status: r.status, address: r.address, notes: r.notes, user_id: r.user_id,
    }),
    validate: {
      last_name: (x) => (x.trim() ? null : "Majburiy"),
      first_name: (x) => (x.trim() ? null : "Majburiy"),
    },
  });
  const v = form.values;

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.check()) return;
    save.mutate({ id, data: { ...v, hire_date: v.hire_date || null, birth_date: v.birth_date || null } }, {
      onSuccess: (saved) => {
        notifyOk("Saqlandi");
        form.commit();
        if (isNew) navigate(`/employees/${saved.id}`, { replace: true });
      },
      onError: (err) => applyServerErrors(form, err),
    });
  };

  if (!isNew && !e) return null;
  const statuses = Object.entries(EMP_STATUS) as [EmployeeStatus, { label: string }][];

  return (
    <form onSubmit={submit}>
      <RecordPage chatter={e ? { model: "employees.employee", id: e.id } : null}>
        <RecordNav listTo="/employees" listLabel="Xodimlar" crumb={e?.code ?? "Yangi"} navKey="employees" id={e?.id} />
        <ActionBar right={
          <div className="flex overflow-hidden rounded-lg border border-line text-xs">
            {statuses.map(([k, s], i) => (
              <button key={k} type="button" disabled={!editable} onClick={() => form.set("status", k)}
                className={`px-3 py-2 ${i ? "border-l border-line" : ""} ${v.status === k ? "bg-accent font-semibold text-white" : "bg-surface text-muted hover:text-ink"}`}>
                {s.label}
              </button>
            ))}
          </div>
        }>
          {editable && <SaveButtons dirty={form.dirty} saving={save.isPending} isNew={isNew} onReset={form.reset} />}
          {e && can.delete && !form.dirty && (
            <DeleteButton busy={remove.isPending}
              onConfirm={() => remove.mutate(e.id, { onSuccess: () => navigate("/employees"), onError: notifyError })} />
          )}
        </ActionBar>

        <Sheet>
          <SheetTitle eyebrow={e ? `Xodim · ${e.code}` : "Xodim"}
            title={isNew ? "Yangi xodim" : [e!.last_name, e!.first_name, e!.middle_name].filter(Boolean).join(" ")} />
          <fieldset disabled={!editable} className="grid gap-6">
            <FieldGrid>
              <Row label="Familiya" required error={form.errors.last_name}><Input {...form.text("last_name")} /></Row>
              <Row label="Ism" required error={form.errors.first_name}><Input {...form.text("first_name")} /></Row>
              <Row label="Otasining ismi"><Input {...form.text("middle_name")} /></Row>
              <Row label="Tug'ilgan sana"><Input type="date" {...form.text("birth_date")} /></Row>
              <Row label="Telefon"><Input placeholder="+998 __ ___ __ __" {...form.text("phone")} /></Row>
              <Row label="Email" error={form.errors.email}><Input type="email" {...form.text("email")} /></Row>
            </FieldGrid>
            <FieldGrid title="Ish joyi">
              <Row label="Bo'lim">
                <Input list="departments" {...form.text("department")} />
                <datalist id="departments">{(departments.data ?? []).map((d) => <option key={d} value={d} />)}</datalist>
              </Row>
              <Row label="Lavozim"><Input {...form.text("position")} /></Row>
              <Row label="Ishga kirgan"><Input type="date" {...form.text("hire_date")} /></Row>
              {canPage("users") && (
                <Row label="Tizim logini" error={form.errors.user_id}>
                  <EntitySelect endpoint="users" disabled={!editable} error={form.errors.user_id}
                    current={e?.user ? { id: e.user.id, name: e.user.username } : null}
                    value={v.user_id} onChange={(uid) => form.set("user_id", uid)} />
                </Row>
              )}
            </FieldGrid>
            <FieldGrid title="Qo'shimcha">
              <Row label="Manzil"><Input {...form.text("address")} /></Row>
              <Row label="Izoh"><Textarea rows={2} {...form.text("notes")} /></Row>
            </FieldGrid>
          </fieldset>
        </Sheet>
      </RecordPage>
    </form>
  );
}

import { Autocomplete, Select, Textarea, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth, useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { FormBar } from "@/components/FormBar";
import { FormSection, FormSheet } from "@/components/FormSection";
import { PageHeader } from "@/components/PageHeader";
import { StatusDot } from "@/components/StatusBadge";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { fromApiDate, toApiDate } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";

import { EMP_STATUS, employeesApi, useDepartments, type Employee, type EmployeeStatus } from "./api";

type Values = {
  last_name: string; first_name: string; middle_name: string; phone: string; email: string;
  department: string; position: string; hire_date: Date | null; birth_date: Date | null;
  status: EmployeeStatus; address: string; notes: string; user_id: number | null;
};

const EMPTY: Values = {
  last_name: "", first_name: "", middle_name: "", phone: "", email: "", department: "", position: "",
  hire_date: null, birth_date: null, status: "active", address: "", notes: "", user_id: null,
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
      department: r.department, position: r.position, hire_date: fromApiDate(r.hire_date),
      birth_date: fromApiDate(r.birth_date), status: r.status, address: r.address, notes: r.notes, user_id: r.user_id,
    }),
    validate: {
      last_name: (v) => (v.trim() ? null : "Majburiy"),
      first_name: (v) => (v.trim() ? null : "Majburiy"),
    },
  });

  const submit = form.onSubmit((v) =>
    save.mutate(
      { id, data: { ...v, hire_date: toApiDate(v.hire_date), birth_date: toApiDate(v.birth_date) } },
      {
        onSuccess: (saved) => {
          notifyOk("Saqlandi");
          form.resetDirty();
          if (isNew) navigate(`/employees/${saved.id}`, { replace: true });
        },
        onError: (err) => applyServerErrors(form, err),
      },
    ),
  );

  if (!isNew && detail.isLoading) return null;

  return (
    <form onSubmit={submit}>
      <PageHeader
        title={isNew ? "Yangi xodim" : e?.name}
        crumbs={[{ label: "Xodimlar", to: "/employees" }, { label: isNew ? "Yangi" : e?.code ?? "" }]}
        extra={e && <StatusDot color={EMP_STATUS[e.status].color} label={EMP_STATUS[e.status].label} />}
      />
      <FormBar
        dirty={form.isDirty()}
        saving={save.isPending}
        canSave={editable}
        onReset={() => form.reset()}
        onDelete={e && can.delete ? () => remove.mutate(e.id, { onSuccess: () => navigate("/employees"), onError: notifyError }) : undefined}
      />
      <div style={{ maxWidth: 920 }}>
        <FormSheet>
          <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }}>
            <FormSection title="Shaxsiy ma'lumotlar" cols={3}>
              <TextInput label="Familiya" required {...form.getInputProps("last_name")} />
              <TextInput label="Ism" required {...form.getInputProps("first_name")} />
              <TextInput label="Otasining ismi" {...form.getInputProps("middle_name")} />
              <DateInput label="Tug'ilgan sana" {...form.getInputProps("birth_date")} />
              <TextInput label="Telefon" placeholder="+998 __ ___ __ __" {...form.getInputProps("phone")} />
              <TextInput label="Email" type="email" {...form.getInputProps("email")} />
            </FormSection>
            <FormSection title="Ish joyi" cols={3}>
              <Autocomplete label="Bo'lim" data={departments.data ?? []} {...form.getInputProps("department")} />
              <TextInput label="Lavozim" {...form.getInputProps("position")} />
              <DateInput label="Ishga kirgan sana" {...form.getInputProps("hire_date")} />
              <Select label="Holat" data={Object.entries(EMP_STATUS).map(([value, s]) => ({ value, label: s.label }))}
                {...form.getInputProps("status")} />
              {canPage("users") && (
                <EntitySelect label="Tizim logini" endpoint="users" disabled={!editable}
                  current={e?.user ? { id: e.user.id, name: e.user.username } : null}
                  {...form.getInputProps("user_id")} />
              )}
            </FormSection>
            <FormSection title="Qo'shimcha">
              <TextInput label="Manzil" {...form.getInputProps("address")} />
              <Textarea label="Izoh" {...form.getInputProps("notes")} />
            </FormSection>
          </fieldset>
        </FormSheet>
      </div>
    </form>
  );
}

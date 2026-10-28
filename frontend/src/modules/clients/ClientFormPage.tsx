import { Anchor, Grid, Paper, SegmentedControl, Select, Stack, Switch, Text, Textarea, TextInput, Title } from "@mantine/core";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { FormBar } from "@/components/FormBar";
import { FormSection, FormSheet } from "@/components/FormSection";
import { PageHeader } from "@/components/PageHeader";
import { ActiveDot, StatusDot } from "@/components/StatusBadge";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { fmtDate, fmtMoney } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { projectsApi } from "@/modules/projects/api";
import { STATUS } from "@/modules/projects/statuses";

import { clientsApi, KIND_LABEL, REGIONS, type Client, type ClientKind } from "./api";

type Values = {
  kind: ClientKind; name: string; tin: string; contact_person: string; phone: string; phone_extra: string;
  email: string; region: string; address: string; source: string; notes: string; is_active: boolean;
  manager_id: number | null;
};

const EMPTY: Values = {
  kind: "individual", name: "", tin: "", contact_person: "", phone: "", phone_extra: "", email: "",
  region: "", address: "", source: "", notes: "", is_active: true, manager_id: null,
};

export function ClientFormPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan("clients");
  const detail = clientsApi.useDetail(isNew ? undefined : id);
  const save = clientsApi.useSave();
  const remove = clientsApi.useRemove();
  const c = detail.data;
  const editable = isNew ? can.create : can.update;

  const form = useServerForm<Values, Client>({
    initial: EMPTY,
    record: c,
    toForm: (r) => ({
      kind: r.kind, name: r.name, tin: r.tin, contact_person: r.contact_person, phone: r.phone,
      phone_extra: r.phone_extra, email: r.email, region: r.region, address: r.address, source: r.source,
      notes: r.notes, is_active: r.is_active, manager_id: r.manager_id,
    }),
    validate: {
      name: (v) => (v.trim().length >= 2 ? null : "Kamida 2 ta belgi"),
      tin: (v) => (!v || /^\d{9,14}$/.test(v) ? null : "9–14 ta raqam"),
    },
  });

  const submit = form.onSubmit((v) =>
    save.mutate(
      { id, data: v },
      {
        onSuccess: (saved) => {
          notifyOk("Saqlandi");
          form.resetDirty();
          if (isNew) navigate(`/clients/${saved.id}`, { replace: true });
        },
        onError: (e) => applyServerErrors(form, e),
      },
    ),
  );

  if (!isNew && detail.isLoading) return null;
  const company = form.values.kind !== "individual";

  return (
    <form onSubmit={submit}>
      <PageHeader
        title={isNew ? "Yangi mijoz" : c?.name}
        crumbs={[{ label: "Mijozlar", to: "/clients" }, { label: isNew ? "Yangi" : c?.code ?? "" }]}
        extra={c && <ActiveDot active={c.is_active} />}
      />
      <FormBar
        dirty={form.isDirty()}
        saving={save.isPending}
        canSave={editable}
        onReset={() => form.reset()}
        onDelete={c && can.delete ? () => remove.mutate(c.id, { onSuccess: () => navigate("/clients"), onError: notifyError }) : undefined}
      />
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <FormSheet>
            <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }}>
              <FormSection title="Mijoz" aside={<SegmentedControl size="xs" disabled={!editable}
                data={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))} {...form.getInputProps("kind")} />}>
                <TextInput label={company ? "Tashkilot nomi" : "F.I.O."} required {...form.getInputProps("name")} />
                <TextInput label="STIR" placeholder={company ? "9 ta raqam" : "ixtiyoriy"} {...form.getInputProps("tin")} />
                {company && <TextInput label="Aloqa shaxsi" {...form.getInputProps("contact_person")} />}
                <EntitySelect label="Mas'ul menejer" endpoint="employees" current={c?.manager} disabled={!editable}
                  extraParams={{ status: "active" }} {...form.getInputProps("manager_id")} />
              </FormSection>
              <FormSection title="Aloqa">
                <TextInput label="Telefon" placeholder="+998 __ ___ __ __" {...form.getInputProps("phone")} />
                <TextInput label="Qo'shimcha telefon" {...form.getInputProps("phone_extra")} />
                <TextInput label="Email" type="email" {...form.getInputProps("email")} />
                <TextInput label="Qayerdan kelgan" placeholder="Tavsiya, Instagram, ko'rgazma…" {...form.getInputProps("source")} />
              </FormSection>
              <FormSection title="Manzil">
                <Select label="Hudud" data={REGIONS} searchable clearable allowDeselect
                  value={form.values.region || null} onChange={(v) => form.setFieldValue("region", v ?? "")} />
                <TextInput label="Manzil" {...form.getInputProps("address")} />
                <Textarea label="Izoh" {...form.getInputProps("notes")} style={{ gridColumn: "1 / -1" }} />
                <Switch label="Faol mijoz" {...form.getInputProps("is_active", { type: "checkbox" })} />
              </FormSection>
            </fieldset>
          </FormSheet>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          {c && <ClientProjects clientId={c.id} total={c.projects_count} />}
        </Grid.Col>
      </Grid>
    </form>
  );
}

function ClientProjects({ clientId, total }: { clientId: number; total: number }) {
  const list = projectsApi.useList({ client: clientId, size: 8, sort: "-created_at" });
  return (
    <Paper p="md">
      <Title order={2} mb="sm">Loyihalar <Text span c="dimmed" size="sm">{total}</Text></Title>
      <Stack gap={10}>
        {list.data?.items.map((p) => (
          <div key={p.id}>
            <Anchor component={Link} to={`/projects/${p.id}`} size="sm" fw={500}>{p.name}</Anchor>
            <Text size="xs" c="dimmed">
              <span className="mono">{p.code}</span> · {fmtDate(p.deadline)} · {fmtMoney(p.amount, p.currency)}
            </Text>
            <StatusDot color={STATUS[p.status].color} label={STATUS[p.status].label} />
          </div>
        ))}
        {total === 0 && <Text size="sm" c="dimmed">Hali loyiha yo'q</Text>}
        {total > 8 && (
          <Anchor component={Link} to={`/projects?client=${clientId}`} size="sm">Barchasini ko'rish →</Anchor>
        )}
      </Stack>
    </Paper>
  );
}

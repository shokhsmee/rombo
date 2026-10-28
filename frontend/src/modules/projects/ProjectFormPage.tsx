import { Alert, Button, Grid, Group, Menu, Modal, NumberInput, Paper, Select, Stack, Text, Textarea, TextInput, Title } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconChevronDown, IconLock } from "@tabler/icons-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { FormBar } from "@/components/FormBar";
import { FormSection, FormSheet } from "@/components/FormSection";
import { PageHeader } from "@/components/PageHeader";
import { StatusDot } from "@/components/StatusBadge";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { fmtDateTime, fromApiDate, toApiDate } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";

import { projectsApi, useChangeStatus, type Currency, type Project, type ProjectStatus } from "./api";
import { ACTION_LABEL, PIPELINE, STATUS } from "./statuses";

type Values = {
  name: string;
  client_id: number | null;
  manager_id: number | null;
  object_address: string;
  region: string;
  contract_number: string;
  contract_date: Date | null;
  deadline: Date | null;
  amount: number | string;
  currency: Currency;
  notes: string;
};

const EMPTY: Values = {
  name: "", client_id: null, manager_id: null, object_address: "", region: "", contract_number: "",
  contract_date: null, deadline: null, amount: 0, currency: "UZS", notes: "",
};

const EDITABLE: ProjectStatus[] = ["draft", "confirmed"];

export function ProjectFormPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan("projects");
  const detail = projectsApi.useDetail(isNew ? undefined : id);
  const save = projectsApi.useSave();
  const remove = projectsApi.useRemove();
  const p = detail.data;

  const locked = !!p && !EDITABLE.includes(p.status);
  const editable = (isNew ? can.create : can.update) && !locked;

  const form = useServerForm<Values, Project>({
    initial: EMPTY,
    record: p,
    toForm: (r) => ({
      name: r.name, client_id: r.client_id, manager_id: r.manager_id, object_address: r.object_address,
      region: r.region, contract_number: r.contract_number, contract_date: fromApiDate(r.contract_date),
      deadline: fromApiDate(r.deadline), amount: Number(r.amount), currency: r.currency, notes: r.notes,
    }),
    validate: {
      name: (v) => (v.trim().length >= 2 ? null : "Kamida 2 ta belgi"),
      client_id: (v) => (v ? null : "Mijozni tanlang"),
    },
  });

  const submit = form.onSubmit((v) => {
    const data = {
      ...v,
      amount: String(v.amount || 0),
      contract_date: toApiDate(v.contract_date),
      deadline: toApiDate(v.deadline),
    };
    save.mutate(
      { id, data },
      {
        onSuccess: (saved) => {
          notifyOk("Saqlandi");
          form.resetDirty();
          if (isNew) navigate(`/projects/${saved.id}`, { replace: true });
        },
        onError: (e) => applyServerErrors(form, e),
      },
    );
  });

  if (!isNew && detail.isLoading) return null;

  return (
    <form onSubmit={submit}>
      <PageHeader
        title={isNew ? "Yangi loyiha" : p?.name}
        crumbs={[{ label: "Loyihalar", to: "/projects" }, { label: isNew ? "Yangi" : p?.code ?? "" }]}
        extra={p && <StatusDot color={STATUS[p.status].color} label={STATUS[p.status].label} />}
      />

      <FormBar
        dirty={form.isDirty()}
        saving={save.isPending}
        canSave={editable}
        onReset={() => form.reset()}
        onDelete={p?.status === "draft" && can.delete
          ? () => remove.mutate(p.id, { onSuccess: () => navigate("/projects"), onError: notifyError })
          : undefined}
        left={p && <StatusActions project={p} canUpdate={can.update} />}
        right={p && <Pipeline status={p.status} />}
      />

      {locked && (
        <Alert icon={<IconLock size={16} />} color="gray" variant="light" mb="sm" py={8}>
          Loyiha «{STATUS[p!.status].label}» bosqichida — asosiy ma'lumotlar qulflangan.
        </Alert>
      )}

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <FormSheet>
            <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }}>
              <FormSection title="Asosiy">
                <TextInput label="Loyiha nomi" required {...form.getInputProps("name")} style={{ gridColumn: "1 / -1" }} />
                <EntitySelect
                  label="Mijoz"
                  required
                  endpoint="clients"
                  current={p?.client}
                  disabled={!editable}
                  {...form.getInputProps("client_id")}
                />
                <EntitySelect
                  label="Mas'ul menejer"
                  endpoint="employees"
                  current={p?.manager}
                  disabled={!editable}
                  extraParams={{ status: "active" }}
                  {...form.getInputProps("manager_id")}
                />
              </FormSection>
              <FormSection title="Shartnoma">
                <TextInput label="Shartnoma raqami" {...form.getInputProps("contract_number")} />
                <DateInput label="Shartnoma sanasi" {...form.getInputProps("contract_date")} />
                <Group grow align="flex-start" gap="xs">
                  <NumberInput label="Summa" min={0} decimalScale={2} {...form.getInputProps("amount")} />
                  <Select label="Valyuta" maw={100} data={["UZS", "USD"]} {...form.getInputProps("currency")} />
                </Group>
                <DateInput label="Topshirish muddati" {...form.getInputProps("deadline")} />
              </FormSection>
              <FormSection title="Obyekt">
                <TextInput label="Hudud" {...form.getInputProps("region")} />
                <TextInput label="Obyekt manzili" {...form.getInputProps("object_address")} />
                <Textarea label="Izoh" {...form.getInputProps("notes")} style={{ gridColumn: "1 / -1" }} />
              </FormSection>
            </fieldset>
          </FormSheet>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          {p && <History project={p} />}
        </Grid.Col>
      </Grid>
    </form>
  );
}

function Pipeline({ status }: { status: ProjectStatus }) {
  if (status === "cancelled") return <StatusDot color={STATUS.cancelled.color} label="Bekor qilingan" />;
  const idx = PIPELINE.indexOf(status);
  return (
    <div className="pipeline" aria-label="Loyiha bosqichlari">
      {PIPELINE.map((s, i) => (
        <div key={s} className="pipeline-step" data-current={i === idx} data-done={i < idx}>
          {STATUS[s].label}
        </div>
      ))}
    </div>
  );
}

function StatusActions({ project, canUpdate }: { project: Project; canUpdate: boolean }) {
  const change = useChangeStatus(project.id);
  const [target, setTarget] = useState<ProjectStatus | null>(null);
  const [comment, setComment] = useState("");

  if (!canUpdate || project.allowed_statuses.length === 0) return null;

  // forward move = primary button; the rest (back, cancel) go into the menu
  const forward: ProjectStatus[] = project.allowed_statuses.filter((s) => s !== "cancelled" && s !== "draft");
  const others = project.allowed_statuses.filter((s) => !forward.includes(s));
  const primary = forward[0];

  const run = (status: ProjectStatus) => {
    if (status === "cancelled") return setTarget(status);
    change.mutate({ status }, { onSuccess: () => notifyOk(STATUS[status].label), onError: notifyError });
  };

  return (
    <>
      {primary && (
        <Button variant="light" loading={change.isPending} onClick={() => run(primary)}>
          {ACTION_LABEL[primary]}
        </Button>
      )}
      {(forward.length > 1 || others.length > 0) && (
        <Menu position="bottom-start" shadow="md">
          <Menu.Target>
            <Button variant="default" rightSection={<IconChevronDown size={14} />}>Boshqa</Button>
          </Menu.Target>
          <Menu.Dropdown>
            {[...forward.slice(1), ...others].map((s) => (
              <Menu.Item key={s} color={s === "cancelled" ? "red" : undefined} onClick={() => run(s)}>
                {ACTION_LABEL[s]}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      )}
      <Modal opened={target === "cancelled"} onClose={() => setTarget(null)} title="Loyihani bekor qilish">
        <Stack>
          <Textarea label="Sabab" required autoFocus minRows={3} value={comment} onChange={(e) => setComment(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setTarget(null)}>Yopish</Button>
            <Button
              color="red"
              disabled={!comment.trim()}
              loading={change.isPending}
              onClick={() =>
                change.mutate(
                  { status: "cancelled", comment },
                  { onSuccess: () => { setTarget(null); setComment(""); notifyOk("Bekor qilindi"); }, onError: notifyError },
                )
              }
            >
              Bekor qilish
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

function History({ project }: { project: Project }) {
  return (
    <Paper p="md">
      <Title order={2} mb="md">Tarix</Title>
      <ul className="timeline">
        {project.history.map((h) => (
          <li key={h.id}>
            <span className="tl-dot" style={{ borderColor: STATUS[h.to_status]?.color }} />
            <div>
              <Text size="sm" fw={500}>
                {h.from_status ? `${STATUS[h.from_status as ProjectStatus]?.label} → ` : ""}
                {STATUS[h.to_status]?.label}
              </Text>
              {h.comment && <Text size="sm" c="dimmed">{h.comment}</Text>}
              <Text size="xs" c="dimmed">
                {fmtDateTime(h.created_at)} · {h.user?.full_name ?? "tizim"}
              </Text>
            </div>
          </li>
        ))}
      </ul>
    </Paper>
  );
}

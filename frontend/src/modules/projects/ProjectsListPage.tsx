import { Button, Chip, Group, Switch, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, type Column } from "@/components/DataTable";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { StatusDot } from "@/components/StatusBadge";
import { useListParams } from "@/hooks/useListParams";
import { fmtDate, fmtMoney, isOverdue } from "@/lib/format";

import { projectsApi, useProjectSummary, type ProjectListItem, type ProjectStatus } from "./api";
import { FINISHED, PIPELINE, STATUS } from "./statuses";

const columns: Column<ProjectListItem>[] = [
  { key: "code", title: "Kod", sort: "code", width: 130, render: (r) => <span className="mono">{r.code}</span> },
  { key: "name", title: "Loyiha", sort: "name", render: (r) => <Text size="sm" fw={500} truncate>{r.name}</Text> },
  { key: "client", title: "Mijoz", render: (r) => r.client.name },
  { key: "status", title: "Holat", sort: "status", width: 170,
    render: (r) => <StatusDot color={STATUS[r.status].color} label={STATUS[r.status].label} /> },
  { key: "manager", title: "Menejer", render: (r) => r.manager?.name ?? <span className="muted">—</span> },
  { key: "deadline", title: "Muddat", sort: "deadline", width: 110,
    render: (r) => (
      <Text size="sm" c={isOverdue(r.deadline, FINISHED.includes(r.status)) ? "red.7" : undefined}>
        {fmtDate(r.deadline)}
      </Text>
    ) },
  { key: "amount", title: "Summa", sort: "amount", align: "right", width: 170,
    render: (r) => fmtMoney(r.amount, r.currency) },
];

export function ProjectsListPage() {
  const can = useCan("projects");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "-created_at" }, ["status"]);
  const list = projectsApi.useList(query);
  const summary = useProjectSummary();

  const selected = (params.filters.status as string[] | undefined) ?? [];
  const counts = Object.fromEntries((summary.data ?? []).map((s) => [s.status, s.count]));
  const statusOptions = [...PIPELINE, "cancelled" as ProjectStatus];

  return (
    <>
      <PageHeader
        title="Loyihalar"
        crumbs={[{ label: "Savdo" }]}
        actions={can.create && (
          <Button component={Link} to="/projects/new" leftSection={<IconPlus size={16} />}>Yangi loyiha</Button>
        )}
      />

      <Chip.Group multiple value={selected} onChange={(v) => update({ filters: { status: v } })}>
        <Group gap={6} mb="sm">
          {statusOptions.map((s) => (
            <Chip key={s} value={s} size="xs" radius="sm" variant="outline">
              {STATUS[s].label}
              <Text span size="xs" c="dimmed" ml={6}>{counts[s] ?? 0}</Text>
            </Chip>
          ))}
        </Group>
      </Chip.Group>

      <DataTable
        columns={columns}
        data={list.data}
        loading={list.isFetching}
        params={params}
        onParams={update}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/projects/${r.id}`)}
        toolbar={
          <>
            <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Kod, nom, mijoz, telefon…" />
            <EntitySelect
              endpoint="clients"
              placeholder="Mijoz"
              w={220}
              value={params.filters.client ? Number(params.filters.client) : null}
              onChange={(id) => update({ filters: { client: id ? String(id) : null } })}
            />
            <EntitySelect
              endpoint="employees"
              placeholder="Menejer"
              w={200}
              value={params.filters.manager ? Number(params.filters.manager) : null}
              onChange={(id) => update({ filters: { manager: id ? String(id) : null } })}
            />
            <Switch
              label="Muddati o'tgan"
              size="sm"
              checked={params.filters.overdue === "true"}
              onChange={(e) => update({ filters: { overdue: e.currentTarget.checked ? "true" : null } })}
            />
          </>
        }
      />
    </>
  );
}

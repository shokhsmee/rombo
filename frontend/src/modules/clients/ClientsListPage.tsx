import { Button, SegmentedControl, Select, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, type Column } from "@/components/DataTable";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { ActiveDot } from "@/components/StatusBadge";
import { useListParams } from "@/hooks/useListParams";

import { clientsApi, KIND_LABEL, REGIONS, type ClientListItem } from "./api";

const columns: Column<ClientListItem>[] = [
  { key: "code", title: "Kod", sort: "code", width: 110, render: (r) => <span className="mono">{r.code}</span> },
  { key: "name", title: "Nomi / F.I.O.", sort: "name", render: (r) => <Text size="sm" fw={500} truncate>{r.name}</Text> },
  { key: "kind", title: "Turi", width: 140, render: (r) => KIND_LABEL[r.kind] },
  { key: "phone", title: "Telefon", width: 170, render: (r) => r.phone || <span className="muted">—</span> },
  { key: "contact", title: "Aloqa shaxsi", render: (r) => r.contact_person || <span className="muted">—</span> },
  { key: "region", title: "Hudud", sort: "region", width: 140, render: (r) => r.region || <span className="muted">—</span> },
  { key: "manager", title: "Menejer", render: (r) => r.manager?.name ?? <span className="muted">—</span> },
  { key: "active", title: "Holat", width: 100, render: (r) => <ActiveDot active={r.is_active} /> },
];

export function ClientsListPage() {
  const can = useCan("clients");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "-created_at" });
  const list = clientsApi.useList(query);
  const f = params.filters;

  return (
    <>
      <PageHeader
        title="Mijozlar"
        crumbs={[{ label: "Savdo" }]}
        actions={can.create && (
          <Button component={Link} to="/clients/new" leftSection={<IconPlus size={16} />}>Yangi mijoz</Button>
        )}
      />
      <DataTable
        columns={columns}
        data={list.data}
        loading={list.isFetching}
        params={params}
        onParams={update}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/clients/${r.id}`)}
        toolbar={
          <>
            <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Nom, STIR, telefon…" />
            <SegmentedControl
              size="xs"
              value={(f.kind as string) || "all"}
              onChange={(v) => update({ filters: { kind: v === "all" ? null : v } })}
              data={[{ value: "all", label: "Barchasi" }, ...Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))]}
            />
            <Select
              placeholder="Hudud"
              w={170}
              clearable
              searchable
              allowDeselect
              data={REGIONS}
              value={(f.region as string) || null}
              onChange={(v) => update({ filters: { region: v } })}
            />
            <EntitySelect
              endpoint="employees"
              placeholder="Menejer"
              w={190}
              value={f.manager ? Number(f.manager) : null}
              onChange={(id) => update({ filters: { manager: id ? String(id) : null } })}
            />
            <Select
              w={130}
              data={[{ value: "true", label: "Faol" }, { value: "false", label: "Nofaol" }]}
              placeholder="Holat"
              clearable
              allowDeselect
              value={(f.is_active as string) || null}
              onChange={(v) => update({ filters: { is_active: v } })}
            />
          </>
        }
      />
    </>
  );
}

import { Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { BulkBar, ExcelMenu, useSelection } from "@/components/ListTools";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { ActivePill } from "@/components/Status";
import { Pill, Segmented } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";
import { fmtDateTime } from "@/lib/format";

import { usersApi, type UserListItem } from "./api";

const initials = (n: string) => n.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

const columns: Column<UserListItem>[] = [
  { key: "name", title: "Foydalanuvchi", sort: "first_name",
    render: (r) => (
      <div className="flex min-w-52 items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-xs font-semibold text-accent-ink">{initials(r.full_name)}</span>
        <div>
          <div className="font-medium">{r.full_name}</div>
          <div className="font-mono text-2xs text-muted">{r.username}</div>
        </div>
      </div>
    ) },
  { key: "roles", title: "Rollar",
    render: (r) =>
      r.is_superuser ? <Pill tone="accent">Superuser</Pill>
        : r.roles.length ? <div className="flex flex-wrap gap-1">{r.roles.map((x) => <Pill key={x.id}>{x.name}</Pill>)}</div>
        : <Pill tone="warn">Rol berilmagan</Pill> },
  { key: "phone", title: "Telefon", className: "whitespace-nowrap tabular", render: (r) => r.phone || <span className="text-muted">—</span> },
  { key: "last_login", title: "Oxirgi kirish", sort: "last_login", className: "whitespace-nowrap text-xs", render: (r) => fmtDateTime(r.last_login) },
  { key: "active", title: "Holat", render: (r) => <ActivePill active={r.is_active} off="Bloklangan" /> },
];

export function UsersListPage() {
  const can = useCan("users");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "first_name" });
  const sel = useSelection(query);
  const list = usersApi.useList(query);

  return (
    <>
      <PageHeader title="Foydalanuvchilar" lede="Tizimga kiradigan hisoblar va ularning rollari."
        action={can.create && (
          <Link to="/settings/users/new" className="press inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-ink">
            <Plus className="size-4" /> Yangi foydalanuvchi
          </Link>
        )} />
      <Toolbar action={<ExcelMenu resource="users" query={query} selection={sel} />}>
        <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Ism, login, telefon…" />
        <EntitySelect endpoint="access/roles" placeholder="Rol" className="w-52"
          value={params.filters.role ? Number(params.filters.role) : null}
          onChange={(id) => update({ filters: { role: id ? String(id) : null } })} />
        <Segmented value={(params.filters.is_active as string) || ""} onChange={(v) => update({ filters: { is_active: v || null } })}
          options={[{ value: "", label: "Barchasi" }, { value: "true", label: "Faol" }, { value: "false", label: "Bloklangan" }]} />
      </Toolbar>
      <BulkBar resource="users" selection={sel} />
      <DataTable selected={sel.ids} onSelect={sel.set} columns={columns} data={list.data} loading={list.isFetching} params={params} onParams={update}
        navKey="users" onRowClick={(r) => navigate(`/settings/users/${r.id}`)} />
    </>
  );
}

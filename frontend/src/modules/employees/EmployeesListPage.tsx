import { Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Pill, Segmented, Select } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";
import { fmtDate } from "@/lib/format";

import { EMP_STATUS, employeesApi, useDepartments, type EmployeeListItem } from "./api";

const initials = (r: EmployeeListItem) => `${r.last_name[0] ?? ""}${r.first_name[0] ?? ""}`.toUpperCase();

const columns: Column<EmployeeListItem>[] = [
  { key: "name", title: "Xodim", sort: "last_name",
    render: (r) => (
      <div className="flex min-w-56 items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-xs font-semibold text-accent-ink">{initials(r)}</span>
        <div>
          <div className="font-medium">{[r.last_name, r.first_name, r.middle_name].filter(Boolean).join(" ")}</div>
          <div className="font-mono text-2xs text-muted">{r.code}</div>
        </div>
      </div>
    ) },
  { key: "position", title: "Lavozim", sort: "department",
    render: (r) => (
      <div>
        <div>{r.position || <span className="text-muted">—</span>}</div>
        {r.department && <div className="text-xs text-muted">{r.department}</div>}
      </div>
    ) },
  { key: "phone", title: "Telefon", className: "whitespace-nowrap tabular", render: (r) => r.phone || <span className="text-muted">—</span> },
  { key: "hire", title: "Ishga kirgan", sort: "hire_date", className: "whitespace-nowrap text-xs", render: (r) => fmtDate(r.hire_date) },
  { key: "user", title: "Login", className: "font-mono text-xs", render: (r) => r.user?.username ?? <span className="font-sans text-muted">—</span> },
  { key: "status", title: "Holat", render: (r) => <Pill tone={EMP_STATUS[r.status].tone}>{EMP_STATUS[r.status].label}</Pill> },
];

export function EmployeesListPage() {
  const can = useCan("employees");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "last_name" });
  const list = employeesApi.useList(query);
  const departments = useDepartments();

  return (
    <>
      <PageHeader title="Xodimlar"
        action={can.create && (
          <Link to="/employees/new" className="press inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-ink">
            <Plus className="size-4" /> Yangi xodim
          </Link>
        )} />
      <Toolbar>
        <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="F.I.O., telefon, lavozim…" />
        <Segmented value={(params.filters.status as string) || ""} onChange={(s) => update({ filters: { status: s || null } })}
          options={[{ value: "", label: "Barchasi" }, ...Object.entries(EMP_STATUS).map(([value, s]) => ({ value, label: s.label }))]} />
        <Select className="w-48" value={(params.filters.department as string) || ""} onChange={(e) => update({ filters: { department: e.target.value || null } })}>
          <option value="">Bo'lim: barchasi</option>
          {(departments.data ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
        </Select>
      </Toolbar>
      <DataTable columns={columns} data={list.data} loading={list.isFetching} params={params} onParams={update}
        navKey="employees" onRowClick={(r) => navigate(`/employees/${r.id}`)} />
    </>
  );
}

import { Button, SegmentedControl, Select, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, type Column } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { StatusDot } from "@/components/StatusBadge";
import { useListParams } from "@/hooks/useListParams";
import { fmtDate } from "@/lib/format";

import { EMP_STATUS, employeesApi, useDepartments, type EmployeeListItem } from "./api";

const columns: Column<EmployeeListItem>[] = [
  { key: "code", title: "Tabel №", sort: "code", width: 100, render: (r) => <span className="mono">{r.code}</span> },
  { key: "name", title: "F.I.O.", sort: "last_name",
    render: (r) => <Text size="sm" fw={500}>{[r.last_name, r.first_name, r.middle_name].filter(Boolean).join(" ")}</Text> },
  { key: "department", title: "Bo'lim", sort: "department", render: (r) => r.department || <span className="muted">—</span> },
  { key: "position", title: "Lavozim", sort: "position", render: (r) => r.position || <span className="muted">—</span> },
  { key: "phone", title: "Telefon", width: 170, render: (r) => r.phone || <span className="muted">—</span> },
  { key: "hire", title: "Ishga kirgan", sort: "hire_date", width: 120, render: (r) => fmtDate(r.hire_date) },
  { key: "user", title: "Login", width: 120,
    render: (r) => (r.user ? <span className="mono">{r.user.username}</span> : <span className="muted">—</span>) },
  { key: "status", title: "Holat", width: 120,
    render: (r) => <StatusDot color={EMP_STATUS[r.status].color} label={EMP_STATUS[r.status].label} /> },
];

export function EmployeesListPage() {
  const can = useCan("employees");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "last_name" });
  const list = employeesApi.useList(query);
  const departments = useDepartments();

  return (
    <>
      <PageHeader
        title="Xodimlar"
        actions={can.create && (
          <Button component={Link} to="/employees/new" leftSection={<IconPlus size={16} />}>Yangi xodim</Button>
        )}
      />
      <DataTable
        columns={columns}
        data={list.data}
        loading={list.isFetching}
        params={params}
        onParams={update}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/employees/${r.id}`)}
        toolbar={
          <>
            <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="F.I.O., telefon, lavozim…" />
            <SegmentedControl
              size="xs"
              value={(params.filters.status as string) || "all"}
              onChange={(v) => update({ filters: { status: v === "all" ? null : v } })}
              data={[{ value: "all", label: "Barchasi" },
                ...Object.entries(EMP_STATUS).map(([value, s]) => ({ value, label: s.label }))]}
            />
            <Select
              placeholder="Bo'lim"
              w={190}
              clearable
              allowDeselect
              data={departments.data ?? []}
              value={(params.filters.department as string) || null}
              onChange={(v) => update({ filters: { department: v } })}
            />
          </>
        }
      />
    </>
  );
}

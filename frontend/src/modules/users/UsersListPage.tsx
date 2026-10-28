import { Badge, Button, Group, Select, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, type Column } from "@/components/DataTable";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { ActiveDot } from "@/components/StatusBadge";
import { useListParams } from "@/hooks/useListParams";
import { fmtDateTime } from "@/lib/format";

import { usersApi, type UserListItem } from "./api";

const columns: Column<UserListItem>[] = [
  { key: "name", title: "F.I.O.", sort: "first_name", render: (r) => <Text size="sm" fw={500}>{r.full_name}</Text> },
  { key: "username", title: "Login", sort: "username", width: 150, render: (r) => <span className="mono">{r.username}</span> },
  { key: "roles", title: "Rollar",
    render: (r) =>
      r.is_superuser ? (
        <Badge size="sm" color="ink" variant="light">Superuser</Badge>
      ) : r.roles.length ? (
        <Group gap={4} wrap="nowrap">{r.roles.map((x) => <Badge key={x.id} size="sm" color="gray">{x.name}</Badge>)}</Group>
      ) : (
        <Text size="sm" c="orange.8">Rol berilmagan</Text>
      ) },
  { key: "phone", title: "Telefon", width: 160, render: (r) => r.phone || <span className="muted">—</span> },
  { key: "last_login", title: "Oxirgi kirish", sort: "last_login", width: 150, render: (r) => fmtDateTime(r.last_login) },
  { key: "active", title: "Holat", width: 110, render: (r) => <ActiveDot active={r.is_active} off="Bloklangan" /> },
];

export function UsersListPage() {
  const can = useCan("users");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "first_name" });
  const list = usersApi.useList(query);

  return (
    <>
      <PageHeader
        title="Foydalanuvchilar"
        crumbs={[{ label: "Sozlamalar" }]}
        actions={can.create && (
          <Button component={Link} to="/settings/users/new" leftSection={<IconPlus size={16} />}>Yangi foydalanuvchi</Button>
        )}
      />
      <DataTable
        columns={columns}
        data={list.data}
        loading={list.isFetching}
        params={params}
        onParams={update}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/settings/users/${r.id}`)}
        toolbar={
          <>
            <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Ism, login, telefon…" />
            <EntitySelect
              endpoint="access/roles"
              placeholder="Rol"
              w={200}
              value={params.filters.role ? Number(params.filters.role) : null}
              onChange={(id) => update({ filters: { role: id ? String(id) : null } })}
            />
            <Select
              w={150}
              placeholder="Holat"
              clearable
              allowDeselect
              data={[{ value: "true", label: "Faol" }, { value: "false", label: "Bloklangan" }]}
              value={(params.filters.is_active as string) || null}
              onChange={(v) => update({ filters: { is_active: v } })}
            />
          </>
        }
      />
    </>
  );
}

import { Badge, Button, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, type Column } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { useListParams } from "@/hooks/useListParams";

import { rolesApi, type RoleListItem } from "./api";

const columns: Column<RoleListItem>[] = [
  { key: "name", title: "Rol", sort: "name",
    render: (r) => (
      <Text size="sm" fw={500} span>
        {r.name}
        {r.is_system && <Badge ml={8} size="xs" color="gray" variant="outline">tizim</Badge>}
      </Text>
    ) },
  { key: "description", title: "Tavsif", render: (r) => r.description || <span className="muted">—</span> },
  { key: "users", title: "Foydalanuvchilar", align: "right", width: 150, render: (r) => r.users_count },
];

export function RolesListPage() {
  const can = useCan("roles");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "name" });
  const list = rolesApi.useList(query);

  return (
    <>
      <PageHeader
        title="Rollar va ruxsatlar"
        crumbs={[{ label: "Sozlamalar" }]}
        actions={can.create && (
          <Button component={Link} to="/settings/roles/new" leftSection={<IconPlus size={16} />}>Yangi rol</Button>
        )}
      />
      <DataTable
        columns={columns}
        data={list.data}
        loading={list.isFetching}
        params={params}
        onParams={update}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/settings/roles/${r.id}`)}
        toolbar={<SearchInput value={params.q} onChange={(q) => update({ q })} />}
      />
    </>
  );
}

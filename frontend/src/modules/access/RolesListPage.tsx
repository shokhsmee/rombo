import { Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Pill } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";

import { rolesApi, type RoleListItem } from "./api";

const columns: Column<RoleListItem>[] = [
  { key: "name", title: "Rol", sort: "name",
    render: (r) => (
      <span className="inline-flex items-center gap-2 font-medium">
        {r.name}
        {r.is_system && <Pill>tizim</Pill>}
      </span>
    ) },
  { key: "description", title: "Tavsif", className: "text-muted", render: (r) => r.description || "—" },
  { key: "users", title: "Foydalanuvchilar", align: "right", render: (r) => r.users_count },
];

export function RolesListPage() {
  const can = useCan("roles");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "name" });
  const list = rolesApi.useList(query);

  return (
    <>
      <PageHeader title="Rollar va ruxsatlar" lede="Rol — har bir sahifa uchun ko'rish, yaratish, tahrirlash va o'chirish ruxsati."
        action={can.create && (
          <Link to="/settings/roles/new" className="press inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-ink">
            <Plus className="size-4" /> Yangi rol
          </Link>
        )} />
      <Toolbar><SearchInput value={params.q} onChange={(q) => update({ q })} /></Toolbar>
      <DataTable columns={columns} data={list.data} loading={list.isFetching} params={params} onParams={update}
        navKey="roles" onRowClick={(r) => navigate(`/settings/roles/${r.id}`)} />
    </>
  );
}

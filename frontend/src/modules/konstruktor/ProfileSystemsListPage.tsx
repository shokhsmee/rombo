import { Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { ActivePill } from "@/components/Status";
import { Pill } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";

import { systemsApi, type SystemListItem } from "./api";

const columns: Column<SystemListItem>[] = [
  { key: "name", title: "Profil tizimi", sort: "name",
    render: (r) => (
      <div>
        <div className="font-medium">{r.name}</div>
        <div className="text-xs text-muted">{r.price_list.name} · xlist {Number(r.bar_length_mm)} mm</div>
      </div>
    ) },
  { key: "type", title: "Buyurtma turi", render: (r) => r.product_type?.name ?? "—" },
  { key: "used", title: "Konstruksiyalar", align: "right", render: (r) => r.constructions_count },
  { key: "check", title: "Sex", render: (r) => (r.needs_check ? <Pill tone="warn">Tekshirilmagan</Pill> : <Pill tone="ok">Tasdiqlangan</Pill>) },
  { key: "active", title: "Holat", render: (r) => <ActivePill active={r.is_active} /> },
];

export function ProfileSystemsListPage() {
  const can = useCan("profile_systems");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "name" });
  const list = systemsApi.useList(query);
  return (
    <>
      <PageHeader title="Profil tizimlari"
        lede="Har bir seriya sexda qanday yig'iladi: profil enlari, zaxiralar, oyna ayirmalari va narx ro'yxati bilan bog'lanishi. Konstruktor shular bo'yicha hisoblaydi."
        action={can.create && (
          <Link to="/settings/profile-systems/new" className="press inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-ink">
            <Plus className="size-4" /> Yangi tizim
          </Link>
        )} />
      <Toolbar><SearchInput value={params.q} onChange={(q) => update({ q })} /></Toolbar>
      <DataTable columns={columns} data={list.data} loading={list.isFetching} params={params} onParams={update}
        navKey="profile_systems" onRowClick={(r) => navigate(`/settings/profile-systems/${r.id}`)} />
    </>
  );
}

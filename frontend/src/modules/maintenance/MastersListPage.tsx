import { Plus, Send, Star } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { ActivePill } from "@/components/Status";
import { Pill, Segmented } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";

import { mastersApi, type MasterListItem } from "./api";
import { PAGE_MASTERS } from "./labels";

export function TelegramBadge({ tg }: { tg: MasterListItem["telegram"] }) {
  if (!tg) return <span className="text-xs text-muted">—</span>;
  return (
    <span title={tg.username ? `@${tg.username}` : tg.name}>
      <Pill tone={tg.blocked ? "warn" : "info"}>
        <Send className="mr-1 size-3" strokeWidth={1.75} /> {tg.blocked ? "Bloklagan" : "Ulangan"}
      </Pill>
    </span>
  );
}

export const fmtRating = (v: number | null) =>
  v == null ? <span className="text-muted">—</span>
    : <span className="inline-flex items-center gap-1 tabular"><Star className="size-3.5 fill-current text-warn" strokeWidth={1.75} />{v.toFixed(1)}</span>;

const columns: Column<MasterListItem>[] = [
  { key: "name", title: "Usta", sort: "name",
    render: (r) => (
      <div className="min-w-48">
        <div className="font-medium">{r.name}</div>
        <div className="font-mono text-2xs text-muted">{r.code}{r.skills && <span className="font-sans"> · {r.skills}</span>}</div>
      </div>
    ) },
  { key: "phone", title: "Telefon", className: "whitespace-nowrap tabular", render: (r) => r.phone || <span className="text-muted">—</span> },
  { key: "region", title: "Hudud", sort: "region", render: (r) => r.region || <span className="text-muted">—</span> },
  { key: "telegram", title: "Telegram", render: (r) => <TelegramBadge tg={r.telegram} /> },
  { key: "active", title: "Ochiq ishlar", align: "right", className: "tabular",
    render: (r) => (r.active_jobs ? <span className="font-medium">{r.active_jobs}</span> : <span className="text-muted">0</span>) },
  { key: "done", title: "Bajarilgan", align: "right", className: "tabular", render: (r) => r.done_jobs },
  { key: "rating", title: "Baho", render: (r) => fmtRating(r.rating_avg) },
  { key: "is_active", title: "Holat", render: (r) => <ActivePill active={r.is_active} /> },
];

export function MastersListPage() {
  const can = useCan(PAGE_MASTERS);
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "name" });
  const list = mastersApi.useList(query);

  return (
    <>
      <PageHeader title="Ustalar" lede="Servis ishlarini bajaradigan ustalar. Usta botda telefonini yuborsa, Telegram avtomatik ulanadi."
        action={can.create && (
          <Link to="/service/masters/new" className="press inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-ink">
            <Plus className="size-4" /> Yangi usta
          </Link>
        )} />
      <Toolbar>
        <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="F.I.O., telefon, hudud…" />
        <Segmented value={(params.filters.is_active as string) || ""} onChange={(s) => update({ filters: { is_active: s || null } })}
          options={[{ value: "", label: "Barchasi" }, { value: "true", label: "Faol" }, { value: "false", label: "Nofaol" }]} />
      </Toolbar>
      <DataTable columns={columns} data={list.data} loading={list.isFetching} params={params} onParams={update}
        navKey="service_masters" onRowClick={(r) => navigate(`/service/masters/${r.id}`)} empty="Ustalar yo'q" />
    </>
  );
}

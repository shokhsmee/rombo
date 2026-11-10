import { Bot, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Pill, Segmented, Select } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";
import { fmtDate } from "@/lib/format";

import { ideasApi, type IdeaListItem } from "./api";
import { KIND, PAGE_IDEAS, PRIORITY, SOURCE, STATUS, type IdeaKind, type IdeaStatus } from "./labels";

const columns: Column<IdeaListItem>[] = [
  { key: "title", title: "Taklif", sort: "code",
    render: (r) => (
      <div className="min-w-64">
        <div className="font-medium">{r.title}</div>
        <div className="font-mono text-2xs text-muted">{r.code}{r.capability && <span className="font-sans"> · {r.capability}</span>}</div>
      </div>
    ) },
  { key: "kind", title: "Turi", render: (r) => KIND[r.kind] },
  { key: "priority", title: "Muhimlik", sort: "priority", render: (r) => <Pill tone={PRIORITY[r.priority].tone}>{PRIORITY[r.priority].label}</Pill> },
  { key: "status", title: "Holat", sort: "status", render: (r) => <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill> },
  { key: "source", title: "Manba",
    render: (r) => (
      <span className="inline-flex items-center gap-1 text-xs">
        {r.source === "mcp" && <Bot className="size-3.5 text-accent" strokeWidth={1.75} />}
        {SOURCE[r.source]}
      </span>
    ) },
  { key: "author", title: "Muallif", render: (r) => <span className="text-xs">{r.created_by?.full_name ?? "—"}</span> },
  { key: "created_at", title: "Sana", sort: "created_at", className: "whitespace-nowrap tabular", render: (r) => fmtDate(r.created_at) },
];

export function IdeasListPage() {
  const can = useCan(PAGE_IDEAS);
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "-created_at" });
  const list = ideasApi.useList(query);
  const status = (params.filters.status as string) || "";

  return (
    <>
      <PageHeader title="Takliflar"
        lede="Tuzatish va yaxshilash g'oyalari. Claude spetsifikatsiya bilan tizimni solishtirib yozadi, siz ko'rib chiqasiz."
        action={can.create && (
          <Link to="/system/ideas/new" className="press inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-ink">
            <Plus className="size-4" /> Yangi taklif
          </Link>
        )} />
      <Toolbar>
        <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Kod, sarlavha, muammo…" />
        <Segmented value={status as IdeaStatus | ""} onChange={(s) => update({ filters: { status: s || null } })}
          options={[{ value: "", label: "Barchasi" }, ...(Object.keys(STATUS) as IdeaStatus[]).map((s) => ({ value: s, label: STATUS[s].label }))]} />
        <Select className="w-44" value={(params.filters.kind as string) || ""} onChange={(e) => update({ filters: { kind: e.target.value || null } })}>
          <option value="">Har qanday tur</option>
          {(Object.keys(KIND) as IdeaKind[]).map((k) => <option key={k} value={k}>{KIND[k]}</option>)}
        </Select>
      </Toolbar>
      <DataTable columns={columns} data={list.data} loading={list.isFetching} params={params} onParams={update}
        navKey="fix_ideas" onRowClick={(r) => navigate(`/system/ideas/${r.id}`)} empty="Takliflar yo'q" />
    </>
  );
}

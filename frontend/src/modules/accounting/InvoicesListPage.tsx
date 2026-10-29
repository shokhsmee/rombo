import { Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Pill, Segmented } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";
import { fmtDate } from "@/lib/format";

import { invoicesApi, type InvoiceKind, type InvoiceListItem, type InvoiceStatus } from "./api";
import { INVOICE_KIND, INVOICE_STATUS, money } from "./labels";

const columns: Column<InvoiceListItem>[] = [
  { key: "code", title: "№", sort: "code", className: "whitespace-nowrap font-mono text-xs", render: (r) => r.code },
  { key: "date", title: "Sana", sort: "date", className: "whitespace-nowrap", render: (r) => fmtDate(r.date) },
  { key: "partner", title: "Kontragent",
    render: (r) => (
      <div className="min-w-48">
        <div className="font-medium">{r.partner.name}</div>
        <div className="text-xs text-muted">{INVOICE_KIND[r.kind]}{r.project && <> · {r.project.code}</>}{r.external_number && <> · ESF {r.external_number}</>}</div>
      </div>
    ) },
  { key: "net", title: "Summa", align: "right", render: (r) => money(r.net) },
  { key: "vat", title: "QQS", align: "right", render: (r) => <span className="text-muted">{money(r.vat, true) || "—"}</span> },
  { key: "gross", title: "Jami", sort: "gross", align: "right", render: (r) => <span className="font-medium">{money(r.gross)} {r.currency === "UZS" ? "" : r.currency}</span> },
  { key: "entry", title: "O'tkazma", className: "whitespace-nowrap font-mono text-xs text-muted", render: (r) => r.entry_code ?? "—" },
  { key: "status", title: "Holat", sort: "status", render: (r) => <Pill tone={INVOICE_STATUS[r.status].tone}>{INVOICE_STATUS[r.status].label}</Pill> },
];

export function InvoicesListPage() {
  const can = useCan("invoices");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "-date" }, ["status"]);
  const list = invoicesApi.useList(query);
  const f = params.filters;
  const statuses = (f.status as string[] | undefined) ?? [];
  const toggle = (s: InvoiceStatus) => update({ filters: { status: statuses.includes(s) ? statuses.filter((x) => x !== s) : [...statuses, s] } });

  return (
    <>
      <PageHeader title="Hisob-fakturalar" lede="Mijozga yozilgan va yetkazib beruvchidan olingan hisob-fakturalar (ESF). Tasdiqlash o'tkazma yozadi."
        action={can.create && (
          <Link to="/accounting/invoices/new" className="press inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-ink">
            <Plus className="size-4" /> Yangi hisob-faktura
          </Link>
        )} />
      <Toolbar>
        <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="№, ESF, kontragent, loyiha…" />
        <Segmented value={(f.kind as string) || ""} onChange={(k) => update({ filters: { kind: k || null } })}
          options={[{ value: "", label: "Barchasi" }, ...(Object.keys(INVOICE_KIND) as InvoiceKind[]).map((k) => ({ value: k, label: INVOICE_KIND[k] }))]} />
        <div className="flex gap-1">
          {(Object.keys(INVOICE_STATUS) as InvoiceStatus[]).map((s) => (
            <button key={s} type="button" onClick={() => toggle(s)}
              className={`press rounded-full border px-3 py-1 text-xs font-medium ${statuses.includes(s) ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-muted hover:text-ink"}`}>
              {INVOICE_STATUS[s].label}
            </button>
          ))}
        </div>
        <EntitySelect endpoint="clients" placeholder="Kontragent" className="w-52"
          value={f.partner ? Number(f.partner) : null} onChange={(id) => update({ filters: { partner: id ? String(id) : null } })} />
      </Toolbar>
      <DataTable columns={columns} data={list.data} loading={list.isFetching} params={params} onParams={update}
        navKey="invoices" onRowClick={(r) => navigate(`/accounting/invoices/${r.id}`)} />
    </>
  );
}

import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { BulkBar, ExcelMenu, useSelection } from "@/components/ListTools";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Button, Pill } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";
import { fmtDate } from "@/lib/format";
import { money } from "@/modules/accounting/labels";

import { paymentRequestsApi, type PaymentRequestListItem, type PaymentRequestStatus } from "./api";
import { PAYMENT_REQUEST_STATUS, unit } from "./labels";

const columns: Column<PaymentRequestListItem>[] = [
  { key: "code", title: "№", sort: "code", className: "whitespace-nowrap font-mono text-xs", render: (r) => r.code },
  { key: "created_at", title: "Sana", sort: "created_at", className: "whitespace-nowrap", render: (r) => fmtDate(r.created_at) },
  { key: "partner", title: "Kontragent / asos",
    render: (r) => (
      <div className="min-w-56">
        <div className="font-medium">{r.partner.name}</div>
        <div className="text-xs text-muted">{r.basis || r.purpose?.name}{r.project && <> · {r.project.code}</>}</div>
      </div>
    ) },
  { key: "requested_by", title: "So'radi", className: "whitespace-nowrap text-xs text-muted", render: (r) => r.requested_by || "—" },
  { key: "needed_by", title: "Kerak sana", sort: "needed_by", className: "whitespace-nowrap", render: (r) => fmtDate(r.needed_by) },
  { key: "amount", title: "Summa", sort: "amount", align: "right",
    render: (r) => (
      <div className="whitespace-nowrap">
        <div className="font-medium">{money(r.amount)} {unit(r.currency)}</div>
        {Number(r.paid) > 0 && <div className="text-xs text-ok">to'landi {money(r.paid)}</div>}
      </div>
    ) },
  { key: "status", title: "Holat", sort: "status",
    render: (r) => <Pill tone={PAYMENT_REQUEST_STATUS[r.status].tone}>{PAYMENT_REQUEST_STATUS[r.status].label}</Pill> },
];

/** Pul so'rovlari: what buyers (and later other modules) ask kassa to pay; kassa approves, then pays. */
export function PaymentRequestsListPage() {
  const can = useCan("payment_requests");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "-created_at" }, ["status"]);
  const sel = useSelection(query);
  const list = paymentRequestsApi.useList(query);
  const f = params.filters;
  const statuses = (f.status as string[] | undefined) ?? [];
  const toggle = (s: PaymentRequestStatus) =>
    update({ filters: { status: statuses.includes(s) ? statuses.filter((x) => x !== s) : [...statuses, s] } });

  return (
    <>
      <PageHeader title="Pul so'rovlari" lede="Xarid va boshqa bo'limlar kassadan pul so'raydi. Kassa tasdiqlaydi, keyin chiqim bilan to'laydi."
        action={can.create && <Button onClick={() => navigate("/kassa/payment-requests/new")}><Plus className="size-4" strokeWidth={1.75} /> Yangi so'rov</Button>} />
      <Toolbar action={<ExcelMenu resource="kassa/payment-requests" query={query} selection={sel} />}>
        <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="№, kontragent, loyiha, asos…" />
        <div className="flex flex-wrap gap-1">
          {(Object.keys(PAYMENT_REQUEST_STATUS) as PaymentRequestStatus[]).map((s) => (
            <button key={s} type="button" onClick={() => toggle(s)}
              className={`press rounded-full border px-3 py-1 text-xs font-medium ${statuses.includes(s) ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-muted hover:text-ink"}`}>
              {PAYMENT_REQUEST_STATUS[s].label}
            </button>
          ))}
        </div>
        <EntitySelect endpoint="clients" placeholder="Kontragent" className="w-48"
          value={f.partner ? Number(f.partner) : null} onChange={(id) => update({ filters: { partner: id ? String(id) : null } })} />
        <EntitySelect endpoint="projects" placeholder="Loyiha" className="w-48"
          value={f.project ? Number(f.project) : null} onChange={(id) => update({ filters: { project: id ? String(id) : null } })} />
      </Toolbar>
      <BulkBar resource="kassa/payment-requests" selection={sel} />
      <DataTable selected={sel.ids} onSelect={sel.set} columns={columns} data={list.data} loading={list.isFetching} params={params} onParams={update}
        navKey="payment-requests" onRowClick={(r) => navigate(`/kassa/payment-requests/${r.id}`)} />
    </>
  );
}

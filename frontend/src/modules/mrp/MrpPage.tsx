import { ChevronDown, ChevronRight, ClipboardList } from "lucide-react";
import { Fragment, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { Toolbar } from "@/components/DataTable";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { Button, Checkbox, Empty, Input, Kpi, Select, Spinner, Toggle } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";
import { fmtDate } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { CATEGORY, qty } from "@/modules/inventory/labels";

import { usePlan, usePlanToRequests } from "./api";

/** MRP: what open Loyihas still need, against stock, open orders and requests — and what to buy. */
export function MrpPage() {
  const navigate = useNavigate();
  const canBuy = useCan("procurement").create;
  const { params, update } = useListParams();
  const f = params.filters;
  const plan = usePlan({ category: f.category, project: f.project, deadline_before: f.deadline_before, only_short: f.only_short === "true" });
  const toRequests = usePlanToRequests();
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const rows = plan.data?.rows ?? [];
  const shortIds = rows.filter((r) => Number(r.shortage) > 0).map((r) => r.product.id);
  const toggle = (set: Set<number>, id: number, fn: (s: Set<number>) => void) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id); else n.add(id);
    fn(n);
  };

  return (
    <>
      <PageHeader title="MRP — material rejasi"
        lede="Ochiq loyihalarning qolgan ehtiyoji − ombordagi qoldiq − yo'ldagi buyurtma − so'ralgan = kamomad. Kamomad xarid karrasiga (masalan 6,5 m tayoq) yaxlitlanadi; muddati yaqin loyiha birinchi ta'minlanadi."
        action={canBuy && (
          <Button disabled={!picked.size} busy={toRequests.isPending}
            onClick={() => toRequests.mutate([...picked], {
              onSuccess: (r) => { setPicked(new Set()); notifyOk(`Xarid so'rovlari: ${r.requests.map((x) => x.code).join(", ")}`); navigate("/procurement/requests?status=draft"); },
              onError: notifyError,
            })}>
            <ClipboardList className="size-4" strokeWidth={1.75} /> Xarid so'rovi yaratish{picked.size ? ` (${picked.size})` : ""}
          </Button>
        )} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Kamomad" value={plan.data?.short ?? "—"} sub="mahsulot" tone={plan.data?.short ? "text-warn" : ""}
          onClick={() => update({ filters: { only_short: "true" } })} />
        <Kpi label="Ochiq loyihalar" value={plan.data?.projects ?? "—"} sub="tasdiqlangan → tayyor" />
        <Kpi label="Materiallar" value={rows.length} sub="ehtiyoji bor" />
      </div>
      <Toolbar>
        <Select className="w-44" value={(f.category as string) || ""} onChange={(e) => update({ filters: { category: e.target.value || null } })}>
          <option value="">Barcha turkumlar</option>
          {Object.entries(CATEGORY).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </Select>
        <EntitySelect endpoint="projects" placeholder="Loyiha" className="w-52"
          value={f.project ? Number(f.project) : null} onChange={(id) => update({ filters: { project: id ? String(id) : null } })} />
        <label className="flex items-center gap-2 text-sm text-muted">Muddat ≤
          <Input type="date" className="w-40" value={(f.deadline_before as string) || ""} onChange={(e) => update({ filters: { deadline_before: e.target.value || null } })} />
        </label>
        <Toggle checked={f.only_short === "true"} onChange={(on) => update({ filters: { only_short: on ? "true" : null } })} label="Faqat kamomad" />
      </Toolbar>
      {plan.isLoading ? <Spinner /> : rows.length === 0 ? (
        <Empty>Ehtiyoj yo'q. Loyiha buyumlariga tarkibi bor mahsulot tanlab, loyihani tasdiqlang.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                <th className="w-10 px-3 py-2.5">
                  {canBuy && <Checkbox label="Kamomadlarni tanlash" checked={!!shortIds.length && shortIds.every((i) => picked.has(i))}
                    onChange={(on) => setPicked(on ? new Set(shortIds) : new Set())} />}
                </th>
                <th className="px-3 py-2.5 font-medium">Material</th>
                <th className="px-3 py-2.5 text-right font-medium">Kerak</th>
                <th className="px-3 py-2.5 text-right font-medium">Omborda</th>
                <th className="px-3 py-2.5 text-right font-medium">Yo'lda</th>
                <th className="px-3 py-2.5 text-right font-medium">So'ralgan</th>
                <th className="px-3 py-2.5 text-right font-medium">Kamomad</th>
                <th className="px-3 py-2.5 text-right font-medium">Sotib olish</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const short = Number(r.shortage) > 0;
                const isOpen = open.has(r.product.id);
                return (
                  <Fragment key={r.product.id}>
                    <tr className={`border-b border-line ${short ? "" : "text-muted"}`}>
                      <td className="px-3 py-2">{canBuy && short && <Checkbox label="Tanlash" checked={picked.has(r.product.id)} onChange={() => toggle(picked, r.product.id, setPicked)} />}</td>
                      <td className="px-3 py-2">
                        <button type="button" className="inline-flex items-center gap-1 text-left" onClick={() => toggle(open, r.product.id, setOpen)}>
                          {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                          <span className="font-medium text-ink">{r.product.name}</span>
                        </button>
                        <div className="pl-5 text-xs text-muted">{r.product.code} · {CATEGORY[r.product.category]}{r.product.order_multiple && ` · karra ${qty(r.product.order_multiple)}`}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular">{qty(r.need)} <span className="text-xs text-muted">{r.product.unit}</span></td>
                      <td className="px-3 py-2 text-right tabular">{qty(r.stock)}</td>
                      <td className="px-3 py-2 text-right tabular">{qty(r.on_order)}</td>
                      <td className="px-3 py-2 text-right tabular">{qty(r.requested)}</td>
                      <td className={`px-3 py-2 text-right font-medium tabular ${short ? "text-bad" : ""}`}>{short ? qty(r.shortage) : "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular">{short ? qty(r.to_buy) : "—"}</td>
                    </tr>
                    {isOpen && r.projects.map((a) => (
                      <tr key={a.project.id} className="border-b border-line bg-ground/50 text-xs">
                        <td />
                        <td className="px-3 py-1.5 pl-9"><Link to={`/projects/${a.project.id}`} className="font-mono text-accent-ink hover:underline">{a.project.code}</Link> · {a.project.client}</td>
                        <td className="px-3 py-1.5 text-right tabular">{qty(a.need)}</td>
                        <td colSpan={3} className="px-3 py-1.5 text-right text-muted">muddat {fmtDate(a.project.deadline)} · ta'minlangan {qty(a.covered)}</td>
                        <td className={`px-3 py-1.5 text-right tabular ${Number(a.short) > 0 ? "text-bad" : "text-ok"}`}>{Number(a.short) > 0 ? qty(a.short) : "✓"}</td>
                        <td />
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

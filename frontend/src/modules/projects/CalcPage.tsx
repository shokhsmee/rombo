import { Printer, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { ActionBar, DeleteButton, RecordNav, RecordPage, Sheet, SheetTitle } from "@/components/Record";
import { Button, Input, Kpi, Toggle } from "@/components/ui";
import { fmtDate, fmtMoney, toNum } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";

import { projectsApi, useCalc, useCalcActions } from "./api";

type Draft = Record<number, { qty: string; price: string }>;

/** Same rounding as the paper sheet and the backend: half-up to whole units. */
const lineSum = (qty: string, price: string) => Math.round((toNum(qty) || 0) * (toNum(price) || 0) + 1e-9);
const plain = (v: string) => String(Number(v));

/** Hisob-kitob varaqasi: fill quantities line by line; the order amount follows the total. */
export function CalcPage() {
  const { id, calcId } = useParams();
  const projectId = Number(id);
  const navigate = useNavigate();
  const can = useCan("projects");
  const project = projectsApi.useDetail(projectId);
  const calc = useCalc(projectId, Number(calcId));
  const actions = useCalcActions(projectId);
  const [draft, setDraft] = useState<Draft>({});
  const [onlyFilled, setOnlyFilled] = useState(false);
  const c = calc.data;
  const p = project.data;

  const reset = () => setDraft(Object.fromEntries((c?.lines ?? []).map((l) => [l.id, { qty: plain(l.qty), price: plain(l.price) }])));
  useEffect(() => {
    reset();
  }, [c]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(() => (c?.lines ?? []).some((l) => {
    const d = draft[l.id];
    return d && (toNum(d.qty) !== Number(l.qty) || toNum(d.price) !== Number(l.price));
  }), [c, draft]);
  const total = (c?.lines ?? []).reduce((s, l) => s + lineSum(draft[l.id]?.qty ?? l.qty, draft[l.id]?.price ?? l.price), 0);
  const locked = !!p && !["draft", "confirmed"].includes(p.status);
  const editable = can.update && !locked;
  const bad = Object.values(draft).some((d) => !(toNum(d.qty) >= 0) || !(toNum(d.price) >= 0));

  const save = () => {
    if (!c || bad) return;
    const lines = c.lines
      .filter((l) => draft[l.id] && (toNum(draft[l.id].qty) !== Number(l.qty) || toNum(draft[l.id].price) !== Number(l.price)))
      .map((l) => ({ id: l.id, qty: String(toNum(draft[l.id].qty)), price: String(toNum(draft[l.id].price)) }));
    actions.save.mutate({ id: c.id, lines }, { onSuccess: () => notifyOk("Hisob-kitob saqlandi"), onError: notifyError });
  };

  if (!c || !p) return null;
  const rows = c.lines.filter((l) => !onlyFilled || toNum(draft[l.id]?.qty ?? l.qty) > 0);
  const inSoum = p.currency === "UZS" && c.currency === "USD";

  return (
    <RecordPage chatter={{ model: "projects.project", id: projectId }}>
      <RecordNav listTo="/projects" listLabel="Loyihalar" navKey="calc" crumb={
        <><Link to={`/projects/${projectId}`} className="hover:underline">{p.code}</Link> / Hisob-kitob</>} />

      <ActionBar right={<Toggle label="Faqat to'ldirilganlar" checked={onlyFilled} onChange={setOnlyFilled} />}>
        {editable && (dirty
          ? <>
              <Button onClick={save} busy={actions.save.isPending} disabled={bad}>Saqlash</Button>
              <Button variant="ghost" onClick={reset}>Bekor qilish</Button>
            </>
          : <Button variant="ghost" busy={actions.refresh.isPending}
              onClick={() => actions.refresh.mutate(c.id, { onSuccess: () => notifyOk("Narxlar yangilandi"), onError: notifyError })}>
              <RefreshCw className="size-4" strokeWidth={1.75} /> Narxlarni yangilash
            </Button>)}
        {!dirty && (
          <Button variant="ghost" onClick={() => window.open(`/print/projects/${projectId}/calcs/${c.id}`, "_blank")}>
            <Printer className="size-4" strokeWidth={1.75} /> Chop etish
          </Button>
        )}
        {editable && !dirty && (
          <DeleteButton busy={actions.remove.isPending} text="Hisob-kitob o'chiriladi. Loyiha summasi qolgan hisob-kitoblardan qayta hisoblanadi."
            onConfirm={() => actions.remove.mutate(c.id, { onSuccess: () => navigate(`/projects/${projectId}`), onError: notifyError })} />
        )}
      </ActionBar>

      {locked && (
        <p className="rounded-xl border border-line bg-sunk/60 px-3 py-2 text-sm text-muted">
          Loyiha ishlab chiqarish bosqichida — hisob-kitob qulflangan (u xarid va ishlab chiqarish uchun material ro'yxati).
        </p>
      )}

      <Sheet>
        <SheetTitle eyebrow={`Hisob-kitob · ${p.code} · ${fmtDate(c.calc_date)}`} title={c.title}
          smart={<>
            <Kpi label="Jami" value={`${total.toLocaleString("ru-RU")} ${c.currency}`} />
            {inSoum && <Kpi label="So'mda" value={p.usd_rate ? fmtMoney(total * Number(p.usd_rate), "UZS") : "kurs yo'q"}
              sub={p.usd_rate ? `1 USD = ${fmtMoney(p.usd_rate)}` : "Loyihada USD kursini kiriting"} tone={p.usd_rate ? "" : "text-warn"} />}
          </>} />

        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                <th className="w-10 px-3 py-2.5 font-medium">№</th>
                <th className="px-3 py-2.5 font-medium">Nomi</th>
                <th className="w-20 px-3 py-2.5 font-medium">Birlik</th>
                <th className="w-28 px-3 py-2.5 text-right font-medium">Soni</th>
                <th className="w-28 px-3 py-2.5 text-right font-medium">Narx</th>
                <th className="w-28 px-3 py-2.5 text-right font-medium">Summa</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const d = draft[l.id] ?? { qty: plain(l.qty), price: plain(l.price) };
                const sum = lineSum(d.qty, d.price);
                return (
                  <tr key={l.id} className={`border-b border-line last:border-0 ${sum ? "" : "text-muted"}`}>
                    <td className="px-3 text-xs tabular">{c.lines.indexOf(l) + 1}</td>
                    <td className={`px-3 py-1.5 ${sum ? "font-medium text-ink" : ""}`}>{l.name}</td>
                    <td className="px-3 text-xs">{l.unit}</td>
                    <td className="px-2 py-1">
                      <Input inputMode="decimal" className="h-8 text-right tabular" disabled={!editable} value={d.qty}
                        error={toNum(d.qty) >= 0 ? undefined : "!"}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setDraft({ ...draft, [l.id]: { ...d, qty: e.target.value } })} />
                    </td>
                    <td className="px-2 py-1">
                      <Input inputMode="decimal" className="h-8 text-right tabular" disabled={!editable} value={d.price}
                        error={toNum(d.price) >= 0 ? undefined : "!"}
                        onChange={(e) => setDraft({ ...draft, [l.id]: { ...d, price: e.target.value } })} />
                    </td>
                    <td className="px-3 text-right font-semibold tabular">{sum ? sum.toLocaleString("ru-RU") : "0"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-ground/60">
                <td colSpan={5} className="px-3 py-3 text-right font-semibold">Jami summa</td>
                <td className="px-3 py-3 text-right text-base font-bold tabular">{total.toLocaleString("ru-RU")} {c.currency}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-xs text-muted">Narxlar hisob-kitob tuzilgan kundagi narx ro'yxatidan olingan. «Narxlarni yangilash» joriy narxlarni qayta oladi.</p>
      </Sheet>
    </RecordPage>
  );
}

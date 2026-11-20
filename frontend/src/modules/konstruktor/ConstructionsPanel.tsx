// The Loyiha's constructions as cards with their drawing; from here sales sends them to the hisob-kitob
// and the workshop opens the cutting plan.
import { Calculator, Copy, DraftingCompass, MoreHorizontal, Plus, Scissors, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { Button, Empty, IconButton, Menu } from "@/components/ui";
import { fmtArea, fmtMoney } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";

import { constructionsApi, useDuplicate, useFillCalc, useInvalidateProject, useProjectSummary } from "./api";
import { WindowDrawing } from "./WindowDrawing";

export function ConstructionsPanel({ projectId, locked, canEditCalc }: { projectId: number; locked: boolean; canEditCalc: boolean }) {
  const can = useCan("constructions");
  const navigate = useNavigate();
  const list = constructionsApi.useOfProject(projectId);
  const rows = list.data ?? [];
  const summary = useProjectSummary(projectId, rows.length > 0);
  const fill = useFillCalc(projectId);
  const duplicate = useDuplicate();
  const remove = constructionsApi.useRemove();
  const invalidate = useInvalidateProject();
  const editable = !locked;
  const s = summary.data;
  const currency = Object.keys(s?.totals ?? {})[0];
  const count = rows.reduce((a, c) => a + c.count, 0);
  const area = rows.reduce((a, c) => a + Number(c.area_m2) * c.count, 0);

  if (!can.view) return null;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {can.create && editable && (
          <Link to={`/projects/${projectId}/constructions/new`}
            className="press inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-ink">
            <Plus className="size-4" /> Yangi konstruksiya
          </Link>
        )}
        {rows.length > 0 && canEditCalc && editable && (
          <Button variant="soft" busy={fill.isPending} onClick={() => fill.mutate(undefined, {
            onSuccess: (r) => {
              notifyOk("Hisob-kitob chizmadan to'ldirildi");
              if (r.calcs[0]) navigate(`/projects/${projectId}/calcs/${r.calcs[0].id}`);
            },
            onError: notifyError,
          })}>
            <Calculator className="size-4" strokeWidth={1.75} /> Hisob-kitobga o'tkazish
          </Button>
        )}
        {rows.length > 0 && (
          <Button variant="ghost" onClick={() => navigate(`/projects/${projectId}/cut-plan`)}>
            <Scissors className="size-4" strokeWidth={1.75} /> Raskroy
          </Button>
        )}
        {rows.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-muted">Jami: <b className="text-ink tabular">{count}</b> dona</span>
            <span className="text-muted"><b className="text-ink tabular">{fmtArea(area.toFixed(2))}</b></span>
            {s && currency && <span className="text-muted">Taxminiy: <b className="text-ink tabular">{fmtMoney(s.totals[currency], currency)}</b></span>}
          </div>
        )}
      </div>

      {rows.length === 0 && !list.isLoading && (
        <Empty>
          <span className="grid justify-items-center gap-1.5">
            <DraftingCompass className="size-6 text-faint" strokeWidth={1.5} />
            Hali chizma yo'q. Konstruksiya chizing — profil, oyna va furnitura soni hisob-kitobga o'zi tushadi.
          </span>
        </Empty>
      )}

      {rows.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
          {rows.map((c) => (
            <div key={c.id} className="group relative grid gap-2 rounded-xl border border-line bg-surface p-3 hover:border-accent">
              <Link to={`/projects/${projectId}/constructions/${c.id}`} className="grid gap-2">
                <div className="grid h-32 place-items-center rounded-lg bg-ground/70 p-2">
                  <WindowDrawing design={c.design} compact className="h-full w-full" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{c.name || c.code}</span>
                    {c.count > 1 && <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-ink">× {c.count}</span>}
                  </div>
                  <div className="text-xs text-muted tabular">{c.code} · {c.size_label} · {Number(c.area_m2).toFixed(2)} m²</div>
                </div>
              </Link>
              {editable && (can.create || can.delete) && (
                <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Menu align="right" trigger={() => <IconButton label="Amallar" className="bg-surface/90"><MoreHorizontal className="size-4" /></IconButton>}
                    items={[
                      ...(can.create ? [{ label: "Nusxa olish", icon: <Copy className="size-4 text-muted" />, onClick: () => duplicate.mutate(c.id, { onSuccess: () => notifyOk("Nusxa olindi"), onError: notifyError }) }] : []),
                      ...(can.delete ? [{ label: "O'chirish", danger: true, icon: <Trash2 className="size-4" />, onClick: () => remove.mutate(c.id, { onSuccess: () => { invalidate(); notifyOk("O'chirildi"); }, onError: notifyError }) }] : []),
                    ]} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {s && s.unmapped.length > 0 && (
        <p className="text-xs text-warn">Ba'zi detallar narx ro'yxatiga bog'lanmagan: {s.unmapped.map((u) => u.label).join(", ")}. Profil tizimida bog'lang.</p>
      )}
    </div>
  );
}

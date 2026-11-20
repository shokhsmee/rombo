// Raskroy: every profile of the Loyiha cut from stock bars, bar by bar — the sheet the workshop saws from.
import { Printer } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { ActionBar, RecordNav, Sheet, SheetTitle } from "@/components/Record";
import { Button, Empty, Kpi } from "@/components/ui";
import { projectsApi } from "@/modules/projects/api";

import { useProjectSummary, type CutPlan } from "./api";

export function CutPlanPage() {
  const { id } = useParams();
  const projectId = Number(id);
  const project = projectsApi.useDetail(projectId).data;
  const summary = useProjectSummary(projectId).data;
  if (!project || !summary) return null;
  const plans = Object.values(summary.cut);
  const bars = plans.reduce((a, p) => a + p.count, 0);
  const glass = summary.lines.filter((l) => !l.bars && /м2|m2|м кв/i.test(l.unit) && /стекл/i.test(l.name));

  return (
    <div className="grid gap-3">
      <div className="print:hidden">
        <RecordNav listTo="/projects" listLabel="Loyihalar" navKey="cut" crumb={
          <><Link to={`/projects/${projectId}`} className="hover:underline">{project.code}</Link> / Raskroy</>} />
      </div>
      <div className="print:hidden">
        <ActionBar>
          <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" strokeWidth={1.75} /> Chop etish</Button>
          <span className="text-sm text-muted">Loyihaning barcha konstruksiyalari birga kesiladi — xlist kamroq ketadi.</span>
        </ActionBar>
      </div>
      <Sheet>
        <SheetTitle eyebrow={`Raskroy · ${project.code} · ${project.client.name}`} title="Profil kesish xaritasi"
          smart={<>
            <Kpi label="Xlistlar" value={bars} />
            <Kpi label="Konstruksiyalar" value={summary.count} sub={`${Number(summary.area_m2)} m²`} />
          </>} />
        {plans.length === 0 && <Empty>Kesiladigan profil yo'q.</Empty>}
        {plans.map((plan, i) => <PlanBlock key={i} plan={plan} />)}
        {glass.length > 0 && (
          <div className="grid gap-2">
            <p className="t-label border-b border-line pb-2">Oyna buyurtmasi</p>
            <p className="text-sm text-muted">{glass.map((g) => `${g.name}: ${Number(g.qty)} ${g.unit}`).join(" · ")}. O'lchamlar har konstruksiyaning «Oynalar» bo'limida.</p>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function PlanBlock({ plan }: { plan: CutPlan }) {
  return (
    <div className="grid gap-2 break-inside-avoid">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
        <p className="t-label">{plan.item}</p>
        <p className="text-xs text-muted tabular">
          {plan.count} xlist × {plan.bar_length} mm · detallar {Math.round(plan.total_length)} mm · chiqindi {plan.waste_pct}%
        </p>
      </div>
      <div className="grid gap-1.5">
        {plan.bars.map((bar, i) => (
          <div key={i} className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-2">
            <span className="text-xs font-semibold text-muted tabular">#{i + 1}</span>
            <div className="flex h-9 overflow-hidden rounded-md border border-line bg-surface">
              {bar.pieces.map((p, j) => (
                <div key={j} title={`${p.label}: ${p.length} mm`} style={{ width: `${(p.length / plan.bar_length) * 100}%` }}
                  className={`grid min-w-0 place-items-center border-r-2 border-surface px-0.5 text-2xs font-semibold tabular ${PIECE_TONE[p.role] ?? "bg-sunk text-ink"}`}>
                  <span className="truncate">{p.length}</span>
                </div>
              ))}
              <div className="grid min-w-0 flex-1 place-items-center bg-[repeating-linear-gradient(45deg,var(--color-sunk)_0_6px,transparent_6px_12px)] text-2xs text-muted tabular">
                <span className="truncate" title={`qoldiq ${Math.round(bar.offcut)} mm`}>
                  {bar.offcut / plan.bar_length > 0.09 ? `qoldiq ${Math.round(bar.offcut)}` : ""}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PIECE_TONE: Record<string, string> = {
  frame: "bg-accent-soft text-accent-ink",
  sash: "bg-ok-soft text-ok",
  door_sash: "bg-done-soft text-done",
  mullion: "bg-warn-soft text-warn",
  bead: "bg-info-soft text-info",
};

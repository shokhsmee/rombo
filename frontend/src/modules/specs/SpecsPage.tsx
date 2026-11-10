import { CircleCheck, FileText, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Empty, Pill, Spinner } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

import { useSpecCheck, useSpecDoc, useSpecDocs, type SpecDoc } from "./api";
import { DOC_KIND, type DocKind } from "./labels";
import { Markdown } from "./Markdown";

const ORDER: DocKind[] = ["project", "spec", "change", "archived"];
const fileName = (d: SpecDoc) => d.path.split("/").slice(d.kind === "spec" ? 1 : 2).join("/");

export function SpecsPage() {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState("");
  const docs = useSpecDocs({ q });
  const check = useSpecCheck();
  const selected = sp.get("doc") ? Number(sp.get("doc")) : null;
  const doc = useSpecDoc(selected);
  const items = docs.data?.items ?? [];

  const groups = useMemo(() => {
    const by: Record<DocKind, SpecDoc[]> = { project: [], spec: [], change: [], archived: [] };
    for (const d of items) by[d.kind].push(d);
    return ORDER.map((k) => ({ kind: k, docs: by[k] })).filter((g) => g.docs.length);
  }, [items]);
  const synced = items.reduce<string | null>((m, d) => (!m || d.synced_at > m ? d.synced_at : m), null);
  const problems = check.data?.problems ?? [];

  return (
    <>
      <PageHeader title="Spetsifikatsiyalar"
        lede="Tizim qanday ishlashi kerakligi (OpenSpec). Claude shu matnni o'qib, tizimni tekshiradi va taklif yozadi."
        action={check.data && (problems.length
          ? <Pill tone="warn"><TriangleAlert className="mr-1 size-3" strokeWidth={1.75} />{problems.length} ta nomuvofiqlik</Pill>
          : <Pill tone="ok"><CircleCheck className="mr-1 size-3" strokeWidth={1.75} />Izchil</Pill>)} />

      {problems.length > 0 && (
        <ul className="mb-4 grid gap-1 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-xs text-warn">
          {problems.map((p) => <li key={p} className="font-mono">{p}</li>)}
        </ul>
      )}

      <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="grid content-start gap-3">
          <SearchInput value={q} onChange={setQ} placeholder="Matndan qidirish…" />
          <p className="text-2xs text-muted">Yangilangan: {fmtDateTime(synced)}</p>
          {!docs.isLoading && !items.length && <Empty>{q ? "Topilmadi" : "Hali yuklanmagan: manage.py specs_sync"}</Empty>}
          {groups.map((g) => (
            <details key={g.kind} open={g.kind !== "archived" || !!q} className="rounded-xl border border-line bg-surface">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-muted uppercase">
                {DOC_KIND[g.kind]} <span className="font-normal">· {g.docs.length}</span>
              </summary>
              <ul className="max-h-[50vh] overflow-y-auto pb-1">
                {g.docs.map((d, k) => {
                  const showRef = g.kind === "change" || g.kind === "archived" ? d.ref !== g.docs[k - 1]?.ref : false;
                  return (
                    <li key={d.id}>
                      {showRef && <div className="px-3 pt-2 text-2xs font-semibold text-faint">{d.ref}</div>}
                      <button type="button" onClick={() => setSp({ doc: String(d.id) })}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-ground ${selected === d.id ? "bg-accent-soft text-accent-ink" : ""}`}>
                        <FileText className="size-3.5 shrink-0 text-faint" strokeWidth={1.75} />
                        <span className="min-w-0 flex-1 truncate">{g.kind === "spec" ? d.ref : g.kind === "project" ? "project.md" : fileName(d)}</span>
                        {d.requirements > 0 && <span className="text-2xs text-faint tabular">{d.requirements}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          ))}
        </aside>

        <article className="min-w-0 rounded-xl border border-line bg-surface p-5">
          {selected == null ? (
            <Empty>Chapdan hujjat tanlang</Empty>
          ) : doc.isLoading || !doc.data ? (
            <div className="grid place-items-center py-10"><Spinner /></div>
          ) : (
            <>
              <p className="mb-3 font-mono text-2xs text-muted">openspec/{doc.data.path}</p>
              <Markdown text={doc.data.content} />
            </>
          )}
        </article>
      </div>
    </>
  );
}

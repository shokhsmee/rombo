import { useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Button, ConfirmDialog, IconButton, Input, Pill, Segmented, Spinner, Toggle } from "@/components/ui";
import { notifyError, notifyOk } from "@/lib/notify";

import { REF_KINDS, refsApi, useRefs, type RefItem, type RefKind } from "./api";

/** Sozlamalar → Ma'lumotnomalar: the editable lists behind the order card's pickers. */
export function ReferencesPage() {
  const can = useCan("references");
  const [sp, setSp] = useSearchParams();
  const kind = (sp.get("kind") as RefKind) || "product_type";
  const meta = REF_KINDS.find((k) => k.kind === kind) ?? REF_KINDS[0];
  const list = useRefs(kind);
  const qc = useQueryClient();
  const save = refsApi.useSave();
  const remove = refsApi.useRemove();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [del, setDel] = useState<RefItem | null>(null);

  const refresh = (msg: string) => {
    notifyOk(msg);
    qc.invalidateQueries({ queryKey: ["references"] });
  };
  const add = () => {
    if (!draft.trim()) return;
    const sort = ((list.data ?? []).at(-1)?.sort_order ?? 0) + 10;
    save.mutate({ data: { kind, name: draft.trim(), sort_order: sort } },
      { onSuccess: () => { setDraft(""); refresh("Qo'shildi"); }, onError: notifyError });
  };
  const patch = (it: RefItem, data: Partial<RefItem>, msg = "Saqlandi") =>
    save.mutate({ id: it.id, data }, { onSuccess: () => refresh(msg), onError: notifyError });

  return (
    <>
      <PageHeader title="Ma'lumotnomalar"
        lede="Loyiha va mijoz kartochkasidagi tanlov ro'yxatlari. Ishlatilgan qiymatni o'chirib bo'lmaydi — nofaol qiling." />
      <div className="mb-4">
        <Segmented value={kind} onChange={(k) => setSp({ kind: k }, { replace: true })}
          options={REF_KINDS.map((k) => ({ value: k.kind, label: k.label }))} />
      </div>

      <section className="card max-w-2xl overflow-hidden">
        <header className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{meta.label}</h2>
          <p className="text-xs text-muted">{meta.hint}</p>
        </header>
        {list.isLoading && <div className="grid place-items-center py-8 text-muted"><Spinner /></div>}
        {list.data?.map((it) => (
          <div key={it.id} className="flex items-center gap-3 border-b border-line px-4 py-2 last:border-0">
            {editing?.id === it.id ? (
              <form className="flex flex-1 items-center gap-2"
                onSubmit={(e) => { e.preventDefault(); patch(it, { name: editing.name.trim() }); setEditing(null); }}>
                <Input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <IconButton label="Saqlash" type="submit"><Check className="size-4 text-ok" /></IconButton>
                <IconButton label="Bekor" onClick={() => setEditing(null)}><X className="size-4" /></IconButton>
              </form>
            ) : (
              <>
                <span className={`flex-1 text-sm ${it.is_active ? "" : "text-muted line-through decoration-muted/40"}`}>{it.name}</span>
                {!it.is_active && <Pill>nofaol</Pill>}
                {can.update && (
                  <>
                    <Toggle label="" checked={it.is_active}
                      onChange={(x) => patch(it, { is_active: x }, x ? "Faollashtirildi" : "Nofaol qilindi")} />
                    <IconButton label="Nomini o'zgartirish" onClick={() => setEditing({ id: it.id, name: it.name })}>
                      <Pencil className="size-4" />
                    </IconButton>
                  </>
                )}
                {can.delete && (
                  <IconButton label="O'chirish" className="hover:text-bad" onClick={() => setDel(it)}><Trash2 className="size-4" /></IconButton>
                )}
              </>
            )}
          </div>
        ))}
        {can.create && (
          <form className="flex gap-2 bg-ground/50 px-4 py-3" onSubmit={(e) => { e.preventDefault(); add(); }}>
            <Input placeholder="Yangi qiymat…" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <Button type="submit" busy={save.isPending} disabled={!draft.trim()}><Plus className="size-4" /> Qo'shish</Button>
          </form>
        )}
      </section>

      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger confirmLabel="O'chirish" busy={remove.isPending}
        title="Qiymatni o'chirish"
        text={`«${del?.name}» o'chiriladi. Agar u yozuvlarda ishlatilgan bo'lsa, o'chmaydi — nofaol qiling.`}
        onConfirm={() => del && remove.mutate(del.id, {
          onSuccess: () => { setDel(null); refresh("O'chirildi"); },
          onError: (e) => { setDel(null); notifyError(e); },
        })} />
    </>
  );
}

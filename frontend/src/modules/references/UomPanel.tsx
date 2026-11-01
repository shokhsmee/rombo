import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { useCan } from "@/auth/AuthProvider";
import { Button, ConfirmDialog, Dialog, Field, IconButton, Input, Pill, Select, Spinner, Toggle } from "@/components/ui";
import { notifyError, notifyOk } from "@/lib/notify";
import { qty } from "@/modules/inventory/labels";

import { UOM_CATEGORY, uomsApi, useUoms, type Uom, type UomCategory } from "./api";

type Draft = { id?: number; name: string; category: UomCategory; ratio: string; aliases: string };
const EMPTY: Draft = { name: "", category: "count", ratio: "1", aliases: "" };

/** Ma'lumotnomalar → O'lchov birliklari: the units products are counted in, and how they convert. */
export function UomPanel() {
  const can = useCan("references");
  const list = useUoms();
  const qc = useQueryClient();
  const save = uomsApi.useSave();
  const remove = uomsApi.useRemove();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [del, setDel] = useState<Uom | null>(null);

  const refresh = (msg: string) => {
    notifyOk(msg);
    qc.invalidateQueries({ queryKey: ["references", "uoms"] });
  };
  const submit = () => {
    if (!draft) return;
    const data = { name: draft.name.trim(), category: draft.category, aliases: draft.aliases,
      ratio: draft.category === "other" ? "1" : draft.ratio.replace(",", ".").trim() || "1" };
    save.mutate({ id: draft.id, data }, {
      onSuccess: () => { setDraft(null); refresh(draft.id ? "Saqlandi" : "Qo'shildi"); }, onError: notifyError,
    });
  };
  const base = draft ? UOM_CATEGORY[draft.category].base : "";

  return (
    <section className="card max-w-3xl overflow-hidden">
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">O'lchov birliklari</h2>
          <p className="text-xs text-muted">Mahsulot qaysi birlikda hisoblanadi va birliklar bir-biriga qanday o'giriladi.
            «Boshqa yozilishi» — hujjatlarda uchraydigan nomlar (шт → dona).</p>
        </div>
        {can.create && <Button size="sm" onClick={() => setDraft(EMPTY)}><Plus className="size-4" /> Birlik</Button>}
      </header>
      {list.isLoading && <div className="grid place-items-center py-8 text-muted"><Spinner /></div>}
      {list.data && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-2 font-medium">Birlik</th><th className="px-4 py-2 font-medium">Turkum</th>
              <th className="px-4 py-2 font-medium">Nisbat</th><th className="px-4 py-2 font-medium">Boshqa yozilishi</th>
              <th className="w-28" />
            </tr>
          </thead>
          <tbody>
            {list.data.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className={`px-4 py-2 font-medium ${u.is_active ? "" : "text-muted line-through decoration-muted/40"}`}>
                  {u.name} {!u.is_active && <Pill>nofaol</Pill>}
                </td>
                <td className="px-4 py-2 text-muted">{u.category_label}</td>
                <td className="px-4 py-2 tabular text-muted">
                  {u.category === "other" || u.name === UOM_CATEGORY[u.category].base ? "—" : `1 ${u.name} = ${qty(u.ratio)} ${UOM_CATEGORY[u.category].base}`}
                </td>
                <td className="px-4 py-2 text-xs text-muted">{u.aliases || "—"}</td>
                <td className="px-2">
                  <div className="flex items-center justify-end gap-1">
                    {can.update && (
                      <>
                        <Toggle label="" checked={u.is_active} onChange={(x) => save.mutate({ id: u.id, data: { is_active: x } },
                          { onSuccess: () => refresh(x ? "Faollashtirildi" : "Nofaol qilindi"), onError: notifyError })} />
                        <IconButton label="Tahrirlash" onClick={() => setDraft({ id: u.id, name: u.name, category: u.category, ratio: String(Number(u.ratio)), aliases: u.aliases })}>
                          <Pencil className="size-4" />
                        </IconButton>
                      </>
                    )}
                    {can.delete && <IconButton label="O'chirish" className="hover:text-bad" onClick={() => setDel(u)}><Trash2 className="size-4" /></IconButton>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Dialog open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Birlikni tahrirlash" : "Yangi birlik"}
        footer={<><Button variant="ghost" onClick={() => setDraft(null)}>Bekor</Button>
          <Button busy={save.isPending} disabled={!draft?.name.trim()} onClick={submit}>Saqlash</Button></>}>
        {draft && (
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <Field label="Nomi" required hint="Mahsulotda shunday ko'rinadi: dona, m, m2, kg">
              <Input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Turkum" hint="Bir turkumdagi birliklar bir-biriga o'giriladi (sm → m). «Boshqa» — faqat o'ziga">
              <Select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as UomCategory })}>
                {(Object.keys(UOM_CATEGORY) as UomCategory[]).map((c) => <option key={c} value={c}>{UOM_CATEGORY[c].label}</option>)}
              </Select>
            </Field>
            {draft.category !== "other" && (
              <Field label={`1 ${draft.name.trim() || "birlik"} necha ${base}?`} hint={`Masalan sm uchun 0,01 (${base} — turkumning asosiy birligi)`}>
                <Input inputMode="decimal" className="tabular" value={draft.ratio} onChange={(e) => setDraft({ ...draft, ratio: e.target.value })} />
              </Field>
            )}
            <Field label="Boshqa yozilishi" hint="Vergul bilan: шт, ta, pcs">
              <Input value={draft.aliases} onChange={(e) => setDraft({ ...draft, aliases: e.target.value })} />
            </Field>
          </form>
        )}
      </Dialog>

      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger confirmLabel="O'chirish" busy={remove.isPending}
        title="Birlikni o'chirish"
        text={`«${del?.name}» o'chiriladi. Mahsulotlarda ishlatilgan bo'lsa, o'chmaydi — nofaol qiling.`}
        onConfirm={() => del && remove.mutate(del.id, {
          onSuccess: () => { setDel(null); refresh("O'chirildi"); },
          onError: (e) => { setDel(null); notifyError(e); },
        })} />
    </section>
  );
}

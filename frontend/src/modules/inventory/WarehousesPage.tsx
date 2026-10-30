import { Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { ActivePill } from "@/components/Status";
import { Button, ConfirmDialog, Dialog, Empty, Field, IconButton, Input, Pill, Spinner, Toggle } from "@/components/ui";
import { apiError } from "@/lib/api";
import { notifyError, notifyOk } from "@/lib/notify";

import { useWarehouseActions, useWarehouses, type Warehouse } from "./api";

/** Omborlar: where stock lies. The default one receives goods receipts without a chosen warehouse. */
export function WarehousesPage() {
  const can = useCan("warehouses");
  const list = useWarehouses();
  const [edit, setEdit] = useState<Warehouse | "new" | null>(null);
  const rows = list.data ?? [];

  return (
    <>
      <PageHeader title="Omborlar" lede="Asosiy ombor ta'minot kirimini (KR) ombor tanlanmaganda qabul qiladi. Harakati bor omborni o'chirib bo'lmaydi — nofaol qiling."
        action={can.create && <Button onClick={() => setEdit("new")}><Plus className="size-4" strokeWidth={1.75} /> Ombor</Button>} />
      {list.isLoading ? <Spinner /> : rows.length === 0 ? <Empty>Ombor yo'q — birinchi kirimda «Asosiy ombor» o'zi yaratiladi.</Empty> : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-2.5 font-medium">Nomi</th>
                <th className="px-4 py-2.5 font-medium">Manzil</th>
                <th className="px-4 py-2.5 font-medium">Mas'ul</th>
                <th className="w-28 px-4 py-2.5 font-medium">Holat</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id} className={`border-b border-line last:border-0 ${w.is_active ? "" : "text-muted"}`}>
                  <td className="px-4 py-2.5 font-medium">{w.name} {w.is_default && <Pill tone="accent">Asosiy</Pill>}</td>
                  <td className="px-4 py-2.5 text-muted">{w.address || "—"}</td>
                  <td className="px-4 py-2.5">{w.responsible?.name ?? "—"}</td>
                  <td className="px-4 py-2.5"><ActivePill active={w.is_active} /></td>
                  <td className="px-2">{can.update && <IconButton label="Tahrirlash" onClick={() => setEdit(w)}><Pencil className="size-4" strokeWidth={1.75} /></IconButton>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && <WarehouseDialog row={edit === "new" ? null : edit} canDelete={can.delete} onClose={() => setEdit(null)} />}
    </>
  );
}

function WarehouseDialog({ row, canDelete, onClose }: { row: Warehouse | null; canDelete: boolean; onClose: () => void }) {
  const { save, remove } = useWarehouseActions();
  const [name, setName] = useState(row?.name ?? "");
  const [address, setAddress] = useState(row?.address ?? "");
  const [responsibleId, setResponsibleId] = useState<number | null>(row?.responsible_id ?? null);
  const [isDefault, setDefault] = useState(row?.is_default ?? false);
  const [active, setActive] = useState(row?.is_active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ask, setAsk] = useState(false);

  const submit = () => {
    if (!name.trim()) return setErrors({ name: "Nomini yozing" });
    save.mutate({ id: row?.id, data: { name: name.trim(), address, responsible_id: responsibleId, is_default: isDefault, is_active: active } }, {
      onSuccess: () => { notifyOk("Saqlandi"); onClose(); },
      onError: (e) => { const x = apiError(e); if (x.field) setErrors({ [x.field]: x.message }); else notifyError(e); },
    });
  };

  return (
    <Dialog open onClose={onClose} title={row ? row.name : "Yangi ombor"}
      footer={<>
        {row && canDelete && !row.has_moves && !row.is_default && <Button variant="quiet" className="mr-auto text-bad" onClick={() => setAsk(true)}>O'chirish</Button>}
        <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
        <Button busy={save.isPending} onClick={submit}>Saqlash</Button>
      </>}>
      <Field label="Nomi" required error={errors.name}><Input autoFocus value={name} placeholder="Sex ombori" onChange={(e) => setName(e.target.value)} error={errors.name} /></Field>
      <Field label="Manzil"><Input value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
      <Field label="Mas'ul (omborchi)">
        <EntitySelect endpoint="employees" current={row?.responsible} extraParams={{ status: "active" }} placeholder="—" value={responsibleId} onChange={(id) => setResponsibleId(id)} />
      </Field>
      <Toggle checked={isDefault} onChange={setDefault} label="Asosiy ombor" />
      {errors.is_default && <p className="text-xs text-bad">{errors.is_default}</p>}
      <Toggle checked={active} onChange={setActive} label="Faol" />
      {errors.is_active && <p className="text-xs text-bad">{errors.is_active}</p>}
      <ConfirmDialog open={ask} onClose={() => setAsk(false)} title="Omborni o'chirish" danger confirmLabel="O'chirish" busy={remove.isPending}
        text="Ombor o'chiriladi."
        onConfirm={() => row && remove.mutate(row.id, { onSuccess: () => { setAsk(false); onClose(); }, onError: (e) => { setAsk(false); notifyError(e); } })} />
    </Dialog>
  );
}

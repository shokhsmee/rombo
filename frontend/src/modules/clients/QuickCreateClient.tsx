import { useEffect, useState } from "react";

import { Button, Dialog, Field, Input, Segmented, Select } from "@/components/ui";
import { applyServerErrors } from "@/hooks/useServerForm";
import { notifyOk } from "@/lib/notify";

import { clientsApi, KIND_LABEL, REGIONS, type Client, type ClientKind } from "./api";

type Values = { kind: ClientKind; name: string; phone: string; region: string; address: string; tin: string };

const EMPTY: Values = { kind: "individual", name: "", phone: "", region: "", address: "", tin: "" };
const KINDS: ClientKind[] = ["individual", "company", "dealer"];

/**
 * Odoo-style "Create and edit…" popup for a client: the short form, opened from a picker on another record.
 * `initialName` is the text the user typed; on success the new client is handed back for selection.
 * No <form> element: the dialog usually sits inside the host record's form, and forms cannot nest.
 */
export function QuickCreateClient({ open, initialName, onClose, onCreated }: {
  open: boolean; initialName: string; onClose: () => void; onCreated: (client: Client) => void;
}) {
  const save = clientsApi.useSave();
  const [v, setV] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) { setV({ ...EMPTY, name: initialName }); setErrors({}); }
  }, [open, initialName]);

  const set = <K extends keyof Values>(k: K, val: Values[K]) => { setV((s) => ({ ...s, [k]: val })); setErrors((e) => ({ ...e, [k]: "" })); };
  const company = v.kind !== "individual";

  const submit = () => {
    const errs: Record<string, string> = {};
    if (v.name.trim().length < 2) errs.name = "Kamida 2 ta belgi";
    if (v.tin && !/^\d{9,14}$/.test(v.tin)) errs.tin = "9–14 ta raqam";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    save.mutate({ data: { ...v, name: v.name.trim() } }, {
      onSuccess: (c) => { notifyOk(`Mijoz yaratildi: ${c.name}`); onCreated(c); onClose(); },
      onError: (err) => applyServerErrors({ setErrors }, err),
    });
  };

  // Enter in any field creates; the event must not reach the host form
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); submit(); }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Yangi mijoz" width="max-w-lg"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
        <Button busy={save.isPending} onClick={submit}>Yaratish</Button>
      </>}>
      <div className="grid gap-3" onKeyDown={onKey}>
        <Segmented value={v.kind} onChange={(k) => set("kind", k)} options={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
        <Field label={company ? "Tashkilot nomi" : "F.I.O."} required error={errors.name}>
          <Input autoFocus value={v.name} onChange={(e) => set("name", e.target.value)} error={errors.name} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Telefon" error={errors.phone}>
            <Input placeholder="+998 __ ___ __ __" value={v.phone} onChange={(e) => set("phone", e.target.value)} error={errors.phone} />
          </Field>
          {company && (
            <Field label="STIR" error={errors.tin}>
              <Input inputMode="numeric" placeholder="9 ta raqam" value={v.tin} onChange={(e) => set("tin", e.target.value)} error={errors.tin} />
            </Field>
          )}
          <Field label="Hudud">
            <Select value={v.region} onChange={(e) => set("region", e.target.value)}>
              <option value="">—</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label="Manzil">
            <Input value={v.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-muted">Qolgan ma'lumotlarni keyin mijoz kartochkasida to'ldirish mumkin.</p>
      </div>
    </Dialog>
  );
}

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { ActivePill } from "@/components/Status";
import { Button, ConfirmDialog, Dialog, Empty, Field, IconButton, Input, Spinner, Toggle } from "@/components/ui";
import { apiError } from "@/lib/api";
import { notifyError, notifyOk } from "@/lib/notify";

import { useApprovalStepActions, useApprovalSteps, type ApprovalStep } from "./api";

/** Sozlamalar → Tasdiqlash bosqichlari: a submitted purchase request passes the active steps in order. */
export function ApprovalStepsPage() {
  const can = useCan("approval_steps");
  const steps = useApprovalSteps();
  const [edit, setEdit] = useState<ApprovalStep | "new" | null>(null);
  const rows = steps.data ?? [];
  const nextSeq = rows.length ? Math.max(...rows.map((s) => s.sequence)) + 10 : 10;

  return (
    <>
      <PageHeader title="Tasdiqlash bosqichlari"
        lede="Xarid so'rovi faol bosqichlardan tartib bo'yicha o'tadi; har bir bosqichni o'sha rol a'zosi tasdiqlaydi. Faol bosqich bo'lmasa — bitta tasdiq."
        action={can.create && <Button onClick={() => setEdit("new")}><Plus className="size-4" strokeWidth={1.75} /> Bosqich qo'shish</Button>} />

      {steps.isLoading ? <Spinner /> : rows.length === 0 ? (
        <Empty>Bosqich yo'q — so'rovni «So'rovlarni tasdiqlash» ruxsati bor har kim bir marta tasdiqlaydi.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                <th className="w-20 px-4 py-2.5 font-medium">Tartib</th>
                <th className="px-4 py-2.5 font-medium">Bosqich</th>
                <th className="px-4 py-2.5 font-medium">Kim tasdiqlaydi (rol)</th>
                <th className="w-28 px-4 py-2.5 font-medium">Holat</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={s.id} className={`border-b border-line last:border-0 ${s.is_active ? "" : "text-muted"}`}>
                  <td className="px-4 py-2.5 tabular">{s.sequence}</td>
                  <td className="px-4 py-2.5 font-medium"><span className="mr-2 text-xs text-faint">{i + 1}.</span>{s.name}</td>
                  <td className="px-4 py-2.5">{s.role.name}</td>
                  <td className="px-4 py-2.5"><ActivePill active={s.is_active} /></td>
                  <td className="px-2">
                    {can.update && <IconButton label="Tahrirlash" onClick={() => setEdit(s)}><Pencil className="size-4" strokeWidth={1.75} /></IconButton>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && <StepDialog step={edit === "new" ? null : edit} nextSeq={nextSeq} canDelete={can.delete} onClose={() => setEdit(null)} />}
    </>
  );
}

function StepDialog({ step, nextSeq, canDelete, onClose }: { step: ApprovalStep | null; nextSeq: number; canDelete: boolean; onClose: () => void }) {
  const { save, remove } = useApprovalStepActions();
  const [name, setName] = useState(step?.name ?? "");
  const [sequence, setSequence] = useState(String(step?.sequence ?? nextSeq));
  const [roleId, setRoleId] = useState<number | null>(step?.role_id ?? null);
  const [active, setActive] = useState(step?.is_active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ask, setAsk] = useState(false);

  const submit = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Nomini yozing";
    if (!roleId) errs.role_id = "Rolni tanlang";
    if (!(Number(sequence) >= 0)) errs.sequence = "Raqam kiriting";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    save.mutate({ id: step?.id, data: { name: name.trim(), sequence: Number(sequence), role_id: roleId, is_active: active } }, {
      onSuccess: () => { notifyOk("Saqlandi"); onClose(); },
      onError: (e) => { const x = apiError(e); if (x.field) setErrors({ [x.field]: x.message }); else notifyError(e); },
    });
  };

  return (
    <Dialog open onClose={onClose} title={step ? `Bosqich: ${step.name}` : "Yangi bosqich"}
      footer={<>
        {step && canDelete && <Button variant="quiet" className="mr-auto text-bad" onClick={() => setAsk(true)}>O'chirish</Button>}
        <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
        <Button busy={save.isPending} onClick={submit}>Saqlash</Button>
      </>}>
      <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
        <Field label="Tartib" error={errors.sequence} hint="kichigi oldin">
          <Input inputMode="numeric" className="tabular" value={sequence} onChange={(e) => setSequence(e.target.value)} error={errors.sequence} />
        </Field>
        <Field label="Nomi" required error={errors.name}>
          <Input autoFocus value={name} placeholder="Ta'minot boshlig'i" onChange={(e) => setName(e.target.value)} error={errors.name} />
        </Field>
      </div>
      <Field label="Kim tasdiqlaydi (rol)" required error={errors.role_id} hint="Shu rolning faol a'zolari bosqichni tasdiqlaydi">
        <EntitySelect endpoint="access/roles" current={step?.role} value={roleId} error={errors.role_id} onChange={(id) => setRoleId(id)} />
      </Field>
      <Toggle checked={active} onChange={setActive} label="Faol" />
      <ConfirmDialog open={ask} onClose={() => setAsk(false)} title="Bosqichni o'chirish" danger confirmLabel="O'chirish" busy={remove.isPending}
        text="Bosqich o'chiriladi; o'tgan qarorlar tarixda qoladi. Kutayotgan so'rov bo'lsa — nofaol qiling."
        onConfirm={() => step && remove.mutate(step.id, { onSuccess: () => { setAsk(false); notifyOk("O'chirildi"); onClose(); }, onError: (e) => { setAsk(false); notifyError(e); } })} />
    </Dialog>
  );
}

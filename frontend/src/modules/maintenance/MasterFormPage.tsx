import { CheckCheck, Star, Wrench } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { ActionBar, DeleteButton, FieldGrid, RecordNav, RecordPage, Row, SaveButtons, Sheet, SheetTitle } from "@/components/Record";
import { Input, Smart, Textarea, Toggle } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { notifyError, notifyOk } from "@/lib/notify";

import { mastersApi, type Master } from "./api";
import { PAGE_MASTERS, PAGE_REQUESTS } from "./labels";
import { TelegramBadge } from "./MastersListPage";

type Values = {
  name: string; phone: string; region: string; skills: string; employee_id: number | null; is_active: boolean; notes: string;
};

const EMPTY: Values = { name: "", phone: "", region: "", skills: "", employee_id: null, is_active: true, notes: "" };

export function MasterFormPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan(PAGE_MASTERS);
  const canRequests = useCan(PAGE_REQUESTS);
  const canEmployees = useCan("employees");
  const detail = mastersApi.useDetail(isNew ? undefined : id);
  const save = mastersApi.useSave();
  const remove = mastersApi.useRemove();
  const m = detail.data;
  const editable = isNew ? can.create : can.update;

  const form = useServerForm<Values, Master>({
    initial: EMPTY,
    record: m,
    toForm: (r) => ({
      name: r.name, phone: r.phone, region: r.region, skills: r.skills, employee_id: r.employee_id,
      is_active: r.is_active, notes: r.notes,
    }),
    validate: {
      name: (x) => (x.trim().length >= 2 ? null : "Kamida 2 ta belgi"),
      phone: (x) => (x.replace(/\D/g, "").length >= 9 ? null : "Telefon raqamini to'liq kiriting"),
    },
  });
  const v = form.values;

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.check()) return;
    save.mutate({ id, data: v }, {
      onSuccess: (saved) => {
        notifyOk("Saqlandi");
        form.commit();
        if (isNew) navigate(`/service/masters/${saved.id}`, { replace: true });
      },
      onError: (err) => applyServerErrors(form, err),
    });
  };

  if (!isNew && !m) return null;

  return (
    <form onSubmit={submit}>
      <RecordPage chatter={m ? { model: "maintenance.master", id: m.id } : null}>
        <RecordNav listTo="/service/masters" listLabel="Ustalar" crumb={m?.code ?? "Yangi"} navKey="service_masters" id={m?.id} />
        <ActionBar>
          {editable && <SaveButtons dirty={form.dirty} saving={save.isPending} isNew={isNew} onReset={form.reset} />}
          {m && can.delete && !form.dirty && (
            <DeleteButton busy={remove.isPending} text="Usta o'chiriladi. Arizalari bo'lsa, o'chirish o'rniga nofaol qiling."
              onConfirm={() => remove.mutate(m.id, { onSuccess: () => navigate("/service/masters"), onError: notifyError })} />
          )}
        </ActionBar>

        <Sheet>
          <SheetTitle eyebrow={m ? `Usta · ${m.code}` : "Usta"} title={isNew ? "Yangi usta" : m!.name}
            smart={m && (
              <>
                <Smart icon={<Wrench className="size-4" />} value={m.active_jobs} label="Ochiq ishlar"
                  onClick={canRequests.view ? () => navigate(`/service?master=${m.id}&open=1`) : undefined} />
                <Smart icon={<CheckCheck className="size-4" />} value={m.done_jobs} label="Bajarilgan"
                  onClick={canRequests.view ? () => navigate(`/service?master=${m.id}`) : undefined} />
                <Smart icon={<Star className="size-4" />} value={m.rating_avg == null ? "—" : m.rating_avg.toFixed(1)} label="O'rtacha baho" />
              </>
            )} />
          <fieldset disabled={!editable} className="grid gap-6">
            <FieldGrid>
              <Row label="F.I.O." required error={form.errors.name}><Input {...form.text("name")} /></Row>
              <Row label="Telefon" required error={form.errors.phone}><Input placeholder="+998 __ ___ __ __" {...form.text("phone")} /></Row>
              <Row label="Hudud" error={form.errors.region}><Input placeholder="Masalan: Chilonzor" {...form.text("region")} /></Row>
              <Row label="Ixtisoslik" error={form.errors.skills}><Input placeholder="Furnitura, oyna paket…" {...form.text("skills")} /></Row>
              {canEmployees.view && (
                <Row label="Xodim" error={form.errors.employee_id}>
                  <EntitySelect endpoint="employees" disabled={!editable} error={form.errors.employee_id} current={m?.employee}
                    placeholder="Shtatdagi usta bo'lsa" value={v.employee_id} onChange={(eid) => form.set("employee_id", eid)} />
                </Row>
              )}
              <Row label="Faol" error={form.errors.is_active}>
                <div className="flex h-9 items-center">
                  <Toggle label={v.is_active ? "Ish beriladi" : "Ish berilmaydi"} checked={v.is_active} disabled={!editable}
                    onChange={(x) => form.set("is_active", x)} />
                </div>
              </Row>
              <Row label="Telegram">
                <div className="flex h-9 items-center gap-2 text-sm">
                  <TelegramBadge tg={m?.telegram ?? null} />
                  {m?.telegram
                    ? <span className="text-muted">{m.telegram.name}{m.telegram.username && ` · @${m.telegram.username}`}</span>
                    : <span className="text-xs text-muted">Usta botda telefonini yuborganda ulanadi</span>}
                </div>
              </Row>
            </FieldGrid>
            <FieldGrid title="Qo'shimcha">
              <Row label="Izoh" wide><Textarea rows={2} {...form.text("notes")} /></Row>
            </FieldGrid>
          </fieldset>
        </Sheet>
      </RecordPage>
    </form>
  );
}

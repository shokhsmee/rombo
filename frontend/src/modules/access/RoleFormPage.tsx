import { Users } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { ActionBar, DeleteButton, FieldGrid, RecordNav, RecordPage, Row, SaveButtons, Sheet, SheetTitle } from "@/components/Record";
import { Input, Pill, Smart, Textarea } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { notifyError, notifyOk } from "@/lib/notify";

import { rolesApi, usePages, type Permission, type Role } from "./api";
import { PermissionMatrix } from "./PermissionMatrix";

type Values = { name: string; description: string; permissions: Permission[] };

export function RoleFormPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan("roles");
  const detail = rolesApi.useDetail(isNew ? undefined : id);
  const pages = usePages();
  const save = rolesApi.useSave();
  const remove = rolesApi.useRemove();
  const r = detail.data;
  const editable = isNew ? can.create : can.update;

  const form = useServerForm<Values, Role>({
    initial: { name: "", description: "", permissions: [] },
    record: r,
    // sort so the "dirty" check doesn't flip on row order
    toForm: (x) => ({ name: x.name, description: x.description, permissions: [...x.permissions].sort((a, b) => a.page_key.localeCompare(b.page_key)) }),
    validate: { name: (v) => (v.trim().length >= 2 ? null : "Kamida 2 ta belgi") },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    save.mutate({ id, data: form.values }, {
      onSuccess: (saved) => {
        notifyOk("Rol saqlandi");
        form.commit();
        if (isNew) navigate(`/settings/roles/${saved.id}`, { replace: true });
      },
      onError: (err) => applyServerErrors(form, err),
    });
  };

  if (!isNew && !r) return null;

  const setPerms = (v: Permission[]) => form.set("permissions", [...v].sort((a, b) => a.page_key.localeCompare(b.page_key)));

  return (
    <form onSubmit={submit}>
      <RecordPage chatter={r ? { model: "access.role", id: r.id } : null}>
        <RecordNav listTo="/settings/roles" listLabel="Rollar" crumb={r?.name ?? "Yangi"} navKey="roles" id={r?.id} />
        <ActionBar right={r?.is_system && <Pill>tizim roli</Pill>}>
          {editable && <SaveButtons dirty={form.dirty} saving={save.isPending} isNew={isNew} onReset={form.reset} />}
          {r && !r.is_system && can.delete && !form.dirty && (
            <DeleteButton busy={remove.isPending}
              text={r.users_count ? `Bu rol ${r.users_count} ta foydalanuvchida bor — ulardan ham olib tashlanadi.` : undefined}
              onConfirm={() => remove.mutate(r.id, { onSuccess: () => navigate("/settings/roles"), onError: notifyError })} />
          )}
        </ActionBar>
        <Sheet>
          <SheetTitle eyebrow="Rol" title={isNew ? "Yangi rol" : r!.name}
            smart={r && <Smart icon={<Users className="size-4" />} value={r.users_count} label="Foydalanuvchi"
              onClick={() => navigate(`/settings/users?role=${r.id}`)} />} />
          <fieldset disabled={!editable} className="grid gap-6">
            <FieldGrid>
              <Row label="Nomi" required error={form.errors.name}><Input {...form.text("name")} /></Row>
              <Row label="Tavsif"><Textarea rows={1} {...form.text("description")} /></Row>
            </FieldGrid>
          </fieldset>
          <div className="grid gap-2">
            <p className="t-label border-b border-line pb-2">Sahifalarga ruxsat</p>
            <p className="text-xs text-muted">
              Yaratish, tahrirlash yoki o'chirish belgilansa, ko'rish o'zi yoqiladi.
              {r && r.users_count > 0 && ` O'zgarish ${r.users_count} ta foydalanuvchiga darhol ta'sir qiladi.`}
            </p>
            {pages.data && <PermissionMatrix pages={pages.data} value={form.values.permissions} onChange={editable ? setPerms : undefined} />}
          </div>
        </Sheet>
      </RecordPage>
    </form>
  );
}

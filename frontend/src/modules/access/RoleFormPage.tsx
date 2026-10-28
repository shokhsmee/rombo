import { Anchor, Text, Textarea, TextInput } from "@mantine/core";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { FormBar } from "@/components/FormBar";
import { FormSection, FormSheet } from "@/components/FormSection";
import { PageHeader } from "@/components/PageHeader";
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
    toForm: (x) => ({ name: x.name, description: x.description, permissions: x.permissions }),
    validate: { name: (v) => (v.trim().length >= 2 ? null : "Kamida 2 ta belgi") },
  });

  const submit = form.onSubmit((v) =>
    save.mutate(
      { id, data: v },
      {
        onSuccess: (saved) => {
          notifyOk("Rol saqlandi");
          form.resetDirty();
          if (isNew) navigate(`/settings/roles/${saved.id}`, { replace: true });
        },
        onError: (e) => applyServerErrors(form, e),
      },
    ),
  );

  if (!isNew && detail.isLoading) return null;

  return (
    <form onSubmit={submit}>
      <PageHeader
        title={isNew ? "Yangi rol" : r?.name}
        crumbs={[{ label: "Sozlamalar" }, { label: "Rollar", to: "/settings/roles" }]}
      />
      <FormBar
        dirty={form.isDirty()}
        saving={save.isPending}
        canSave={editable}
        onReset={() => form.reset()}
        onDelete={r && !r.is_system && can.delete
          ? () => remove.mutate(r.id, { onSuccess: () => navigate("/settings/roles"), onError: notifyError })
          : undefined}
        deleteLabel={r?.users_count ? `Bu rol ${r.users_count} ta foydalanuvchida bor. Ulardan ham olib tashlanadi.` : undefined}
      />
      <div style={{ maxWidth: 920 }}>
        <FormSheet>
          <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }}>
            <FormSection title="Rol">
              <TextInput label="Nomi" required {...form.getInputProps("name")} />
              <Textarea label="Tavsif" minRows={1} {...form.getInputProps("description")} />
            </FormSection>
          </fieldset>
          <div className="form-section">
            <div className="form-section-title">Sahifalarga ruxsat</div>
            <Text size="xs" c="dimmed" mb="sm">
              Yaratish, tahrirlash yoki o'chirish belgilansa, ko'rish avtomatik yoqiladi.
              {r && r.users_count > 0 && (
                <> O'zgarishlar <Anchor component={Link} to={`/settings/users?role=${r.id}`} size="xs">{r.users_count} ta foydalanuvchiga</Anchor> darhol ta'sir qiladi.</>
              )}
            </Text>
            {pages.data && (
              <div style={{ border: "1px solid var(--r-border)", borderRadius: 6, overflow: "hidden" }}>
                <PermissionMatrix
                  pages={pages.data}
                  value={form.values.permissions}
                  onChange={editable ? (v) => form.setFieldValue("permissions", v) : undefined}
                />
              </div>
            )}
          </div>
        </FormSheet>
      </div>
    </form>
  );
}

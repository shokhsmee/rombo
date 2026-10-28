import { Alert, Anchor, Button, Grid, Group, Modal, MultiSelect, Paper, PasswordInput, Stack, Switch, Text, TextInput, Title } from "@mantine/core";
import { IconKey } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAuth, useCan, type PageKey } from "@/auth/AuthProvider";
import { FormBar } from "@/components/FormBar";
import { FormSection, FormSheet } from "@/components/FormSection";
import { PageHeader } from "@/components/PageHeader";
import { ActiveDot } from "@/components/StatusBadge";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { fmtDateTime } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { rolesApi, usePages, useRolesUnion, type Permission } from "@/modules/access/api";
import { PermissionMatrix } from "@/modules/access/PermissionMatrix";

import { useResetPassword, usersApi, type User } from "./api";

type Values = {
  username: string; first_name: string; last_name: string; email: string; phone: string;
  is_active: boolean; is_superuser: boolean; role_ids: string[]; password: string;
};

const EMPTY: Values = {
  username: "", first_name: "", last_name: "", email: "", phone: "",
  is_active: true, is_superuser: false, role_ids: [], password: "",
};

export function UserFormPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan("users");
  const { me } = useAuth();
  const detail = usersApi.useDetail(isNew ? undefined : id);
  const roles = rolesApi.useList({ size: 200, sort: "name" });
  const save = usersApi.useSave();
  const u = detail.data;
  const editable = isNew ? can.create : can.update;
  const isSelf = u?.id === me?.id;

  const form = useServerForm<Values, User>({
    initial: EMPTY,
    record: u,
    toForm: (x) => ({
      username: x.username, first_name: x.first_name, last_name: x.last_name, email: x.email, phone: x.phone,
      is_active: x.is_active, is_superuser: x.is_superuser, role_ids: x.roles.map((r) => String(r.id)), password: "",
    }),
    validate: {
      username: (v) => (/^[\w.@+-]{3,}$/.test(v) ? null : "Kamida 3 ta belgi, bo'sh joysiz"),
      first_name: (v) => (v.trim() ? null : "Majburiy"),
      password: (v) => (!isNew || v.length >= 8 ? null : "Kamida 8 ta belgi"),
    },
  });

  const submit = form.onSubmit((v) => {
    const { password, role_ids, ...rest } = v;
    const data = { ...rest, role_ids: role_ids.map(Number), ...(isNew ? { password } : {}) };
    save.mutate(
      { id, data },
      {
        onSuccess: (saved) => {
          notifyOk("Saqlandi");
          form.resetDirty();
          if (isNew) navigate(`/settings/users/${saved.id}`, { replace: true });
        },
        onError: (e) => applyServerErrors(form, e, { roles: "role_ids" }),
      },
    );
  });

  if (!isNew && detail.isLoading) return null;

  return (
    <form onSubmit={submit}>
      <PageHeader
        title={isNew ? "Yangi foydalanuvchi" : u?.full_name}
        crumbs={[{ label: "Sozlamalar" }, { label: "Foydalanuvchilar", to: "/settings/users" }]}
        extra={u && <ActiveDot active={u.is_active} off="Bloklangan" />}
      />
      <FormBar
        dirty={form.isDirty()}
        saving={save.isPending}
        canSave={editable}
        onReset={() => form.reset()}
        right={u && can.update && <ResetPassword userId={u.id} />}
      />
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <FormSheet>
            <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }}>
              <FormSection title="Hisob">
                <TextInput label="Familiya" {...form.getInputProps("last_name")} />
                <TextInput label="Ism" required {...form.getInputProps("first_name")} />
                <TextInput label="Login" required autoComplete="off" {...form.getInputProps("username")} />
                {isNew && <PasswordInput label="Parol" required autoComplete="new-password" {...form.getInputProps("password")} />}
                <TextInput label="Telefon" {...form.getInputProps("phone")} />
                <TextInput label="Email" type="email" {...form.getInputProps("email")} />
              </FormSection>
              <FormSection title="Kirish huquqi" cols={1}>
                <MultiSelect
                  label="Rollar"
                  placeholder="Rol tanlang"
                  searchable
                  disabled={!editable || form.values.is_superuser}
                  data={(roles.data?.items ?? []).map((r) => ({ value: String(r.id), label: r.name }))}
                  {...form.getInputProps("role_ids")}
                />
                <Group gap="xl">
                  <Switch label="Faol" disabled={isSelf} {...form.getInputProps("is_active", { type: "checkbox" })} />
                  <Switch label="Superuser (barcha ruxsatlar)" disabled={isSelf}
                    {...form.getInputProps("is_superuser", { type: "checkbox" })} />
                </Group>
              </FormSection>
            </fieldset>
            {u && (
              <FormSection title="Ma'lumot">
                <Text size="sm"><span className="muted">Oxirgi kirish:</span> {fmtDateTime(u.last_login)}</Text>
                <Text size="sm"><span className="muted">Yaratilgan:</span> {fmtDateTime(u.date_joined)}</Text>
                <Text size="sm">
                  <span className="muted">Xodim:</span>{" "}
                  {u.employee ? <Anchor component={Link} to={`/employees/${u.employee.id}`} size="sm">{u.employee.name}</Anchor> : "biriktirilmagan"}
                </Text>
              </FormSection>
            )}
          </FormSheet>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <AccessPreview roleIds={form.values.role_ids.map(Number)} superuser={form.values.is_superuser} />
        </Grid.Col>
      </Grid>
    </form>
  );
}

/** What this user will see — recomputed live from the selected roles, before saving. */
function AccessPreview({ roleIds, superuser }: { roleIds: number[]; superuser: boolean }) {
  const pages = usePages();
  const union = useRolesUnion(superuser ? [] : roleIds);

  const value = useMemo<Permission[]>(() => {
    if (!pages.data) return [];
    return pages.data.map((p) => {
      const set = union.map[p.key as PageKey];
      const has = (a: string) => superuser ? p.actions.includes(a as never) : !!set?.has(a as never);
      return { page_key: p.key, can_view: has("view"), can_create: has("create"), can_update: has("update"), can_delete: has("delete") };
    });
  }, [pages.data, union.map, superuser]);

  return (
    <Paper p={0}>
      <div style={{ padding: "14px 16px 10px" }}>
        <Title order={2}>Sahifalarga kirish</Title>
        <Text size="xs" c="dimmed">Tanlangan rollar bo'yicha. Ruxsatni o'zgartirish uchun rolni tahrirlang.</Text>
      </div>
      {!superuser && roleIds.length === 0 && (
        <Alert color="orange" variant="light" mx="md" mb="sm" py={8}>Rol berilmagan — foydalanuvchi hech qaysi sahifani ko'rmaydi.</Alert>
      )}
      {pages.data && <PermissionMatrix pages={pages.data} value={value} />}
    </Paper>
  );
}

function ResetPassword({ userId }: { userId: number }) {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const reset = useResetPassword(userId);
  return (
    <>
      <Button variant="default" leftSection={<IconKey size={15} />} onClick={() => setOpen(true)}>Parolni tiklash</Button>
      <Modal opened={open} onClose={() => setOpen(false)} title="Yangi parol">
        <Stack>
          <PasswordInput label="Parol" description="Kamida 8 ta belgi. Foydalanuvchi barcha qurilmalardan chiqariladi."
            autoFocus value={pwd} onChange={(e) => setPwd(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpen(false)}>Yopish</Button>
            <Button
              disabled={pwd.length < 8}
              loading={reset.isPending}
              onClick={() => reset.mutate(pwd, {
                onSuccess: () => { setOpen(false); setPwd(""); notifyOk("Parol yangilandi"); },
                onError: notifyError,
              })}
            >
              Saqlash
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

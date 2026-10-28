import { KeyRound, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth, useCan, type PageKey } from "@/auth/AuthProvider";
import { ActionBar, FieldGrid, RecordNav, RecordPage, Row, SaveButtons, Sheet, SheetTitle } from "@/components/Record";
import { ActivePill } from "@/components/Status";
import { Button, Checkbox, Dialog, Field, Input, Smart, Toggle } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { fmtDateTime } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { rolesApi, usePages, useRolesUnion, type Permission } from "@/modules/access/api";
import { PermissionMatrix } from "@/modules/access/PermissionMatrix";

import { useResetPassword, usersApi, type User } from "./api";

type Values = {
  username: string; first_name: string; last_name: string; email: string; phone: string;
  is_active: boolean; is_superuser: boolean; role_ids: number[]; password: string;
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
      is_active: x.is_active, is_superuser: x.is_superuser, role_ids: x.roles.map((r) => r.id).sort((a, b) => a - b), password: "",
    }),
    validate: {
      username: (v) => (/^[\w.@+-]{3,}$/.test(v) ? null : "Kamida 3 ta belgi, bo'sh joysiz"),
      first_name: (v) => (v.trim() ? null : "Majburiy"),
      password: (v) => (!isNew || v.length >= 8 ? null : "Kamida 8 ta belgi"),
    },
  });
  const v = form.values;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    const { password, ...rest } = v;
    save.mutate({ id, data: { ...rest, ...(isNew ? { password } : {}) } }, {
      onSuccess: (saved) => {
        notifyOk("Saqlandi");
        form.commit();
        if (isNew) navigate(`/settings/users/${saved.id}`, { replace: true });
      },
      onError: (err) => applyServerErrors(form, err, { roles: "role_ids" }),
    });
  };

  if (!isNew && !u) return null;

  const toggleRole = (rid: number, on: boolean) =>
    form.set("role_ids", (on ? [...v.role_ids, rid] : v.role_ids.filter((x) => x !== rid)).sort((a, b) => a - b));

  return (
    <form onSubmit={submit}>
      <RecordPage chatter={u ? { model: "users.user", id: u.id } : null}>
        <RecordNav listTo="/settings/users" listLabel="Foydalanuvchilar" crumb={u?.username ?? "Yangi"} navKey="users" id={u?.id} />
        <ActionBar right={u && <ActivePill active={u.is_active} off="Bloklangan" />}>
          {editable && <SaveButtons dirty={form.dirty} saving={save.isPending} isNew={isNew} onReset={form.reset} />}
          {u && can.update && !form.dirty && <ResetPassword userId={u.id} />}
        </ActionBar>

        <Sheet>
          <SheetTitle eyebrow={u ? `Foydalanuvchi · ${u.username}` : "Foydalanuvchi"}
            title={isNew ? "Yangi foydalanuvchi" : u!.full_name}
            smart={u?.employee && <Smart icon={<UserRound className="size-4" />} value={u.employee.name} label="Xodim kartochkasi"
              onClick={() => navigate(`/employees/${u.employee!.id}`)} />} />
          <fieldset disabled={!editable} className="grid gap-6">
            <FieldGrid>
              <Row label="Familiya"><Input {...form.text("last_name")} /></Row>
              <Row label="Ism" required error={form.errors.first_name}><Input {...form.text("first_name")} /></Row>
              <Row label="Login" required error={form.errors.username}><Input autoComplete="off" className="font-mono" {...form.text("username")} /></Row>
              {isNew && <Row label="Parol" required error={form.errors.password}><Input type="password" autoComplete="new-password" {...form.text("password")} /></Row>}
              <Row label="Telefon"><Input {...form.text("phone")} /></Row>
              <Row label="Email" error={form.errors.email}><Input type="email" {...form.text("email")} /></Row>
            </FieldGrid>

            <FieldGrid title="Kirish huquqi">
              <Row label="Holat">
                <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
                  <Toggle label="Faol" checked={v.is_active} disabled={isSelf || !editable} onChange={(x) => form.set("is_active", x)} />
                  <Toggle label="Superuser" checked={v.is_superuser} disabled={isSelf || !editable} onChange={(x) => form.set("is_superuser", x)} />
                </div>
              </Row>
              <Row label="Rollar" error={form.errors.role_ids} wide>
                <div className={`grid gap-1 rounded-lg border border-line p-1.5 ${v.is_superuser ? "opacity-50" : ""}`}>
                  {(roles.data?.items ?? []).map((r) => (
                    <label key={r.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-ground">
                      <Checkbox label={r.name} checked={v.role_ids.includes(r.id)}
                        onChange={editable && !v.is_superuser ? (x) => toggleRole(r.id, x) : undefined} />
                      <span className="text-sm">{r.name}</span>
                      {r.description && <span className="truncate text-xs text-muted">{r.description}</span>}
                    </label>
                  ))}
                </div>
              </Row>
            </FieldGrid>

            {u && (
              <p className="text-xs text-muted">Oxirgi kirish: {fmtDateTime(u.last_login)} · Yaratilgan: {fmtDateTime(u.date_joined)}</p>
            )}
          </fieldset>
        </Sheet>

        <AccessPreview roleIds={v.role_ids} superuser={v.is_superuser} />
      </RecordPage>
    </form>
  );
}

/** What this user will see — recomputed live from the ticked roles, before saving. */
function AccessPreview({ roleIds, superuser }: { roleIds: number[]; superuser: boolean }) {
  const pages = usePages();
  const union = useRolesUnion(superuser ? [] : roleIds);

  const value = useMemo<Permission[]>(() => {
    if (!pages.data) return [];
    return pages.data.map((p) => {
      const set = union.map[p.key as PageKey];
      const has = (a: string) => (superuser ? p.actions.includes(a as never) : !!set?.has(a as never));
      return { page_key: p.key, can_view: has("view"), can_create: has("create"), can_update: has("update"), can_delete: has("delete") };
    });
  }, [pages.data, union.map, superuser]);

  return (
    <section className="grid gap-2">
      <div>
        <h2 className="t-h2">Sahifalarga kirish</h2>
        <p className="text-xs text-muted">Belgilangan rollar bo'yicha hisoblanadi. Ruxsatni o'zgartirish uchun rolni tahrirlang.</p>
      </div>
      {!superuser && roleIds.length === 0 && (
        <p className="rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-sm text-warn">Rol berilmagan — foydalanuvchi hech qaysi sahifani ko'rmaydi.</p>
      )}
      {pages.data && <PermissionMatrix pages={pages.data} value={value} />}
    </section>
  );
}

function ResetPassword({ userId }: { userId: number }) {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const reset = useResetPassword(userId);
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}><KeyRound className="size-4" strokeWidth={1.75} /> Parolni tiklash</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Yangi parol"
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>Yopish</Button>
          <Button disabled={pwd.length < 8} busy={reset.isPending}
            onClick={() => reset.mutate(pwd, { onSuccess: () => { setOpen(false); setPwd(""); notifyOk("Parol yangilandi"); }, onError: notifyError })}>
            Saqlash
          </Button>
        </>}>
        <Field label="Parol" hint="Kamida 8 ta belgi. Foydalanuvchi barcha qurilmalardan chiqariladi.">
          <Input type="password" autoFocus autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
        </Field>
      </Dialog>
    </>
  );
}

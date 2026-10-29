import dayjs from "dayjs";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { useCan } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { ActivePill } from "@/components/Status";
import { Button, ConfirmDialog, Dialog, ErrorNote, Field, Input, Pill, Segmented, Select, Toggle } from "@/components/ui";
import { apiError } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";

import { KIND_LABEL, ratesApi, useAccountActions, useAccounts, useRoles, useSetRole, type Account, type AccountInput, type AccountKind } from "./api";
import { money } from "./labels";

type Tab = "accounts" | "roles" | "rates";

/** Sozlamalar → Hisoblar rejasi: the NSBU 21 chart (tree), role → account mapping, exchange rates. */
export function AccountsPage() {
  const [tab, setTab] = useState<Tab>("accounts");
  return (
    <>
      <PageHeader title="Hisoblar rejasi" lede="NSBU 21 hisoblar, o'tkazma qoidalari ishlatadigan rollar va Markaziy bank kurslari."
        action={<Segmented value={tab} onChange={setTab} options={[{ value: "accounts", label: "Hisoblar" }, { value: "roles", label: "Rollar" }, { value: "rates", label: "Kurslar" }]} />} />
      {tab === "accounts" && <ChartTab />}
      {tab === "roles" && <RolesTab />}
      {tab === "rates" && <RatesTab />}
    </>
  );
}

// ------------------------------------------------------------------ chart

type Node = Account & { children: Node[] };

function buildTree(rows: Account[]): Node[] {
  const byId = new Map<number, Node>(rows.map((a) => [a.id, { ...a, children: [] }]));
  const roots: Node[] = [];
  for (const n of byId.values()) {
    const parent = n.parent_id ? byId.get(n.parent_id) : undefined;
    (parent ? parent.children : roots).push(n);
  }
  const sort = (ns: Node[]) => { ns.sort((a, b) => a.code.localeCompare(b.code)); ns.forEach((n) => sort(n.children)); };
  sort(roots);
  return roots;
}

function ChartTab() {
  const can = useCan("accounts");
  const accounts = useAccounts();
  const { save, remove } = useAccountActions();
  const [q, setQ] = useState("");
  const [inactive, setInactive] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [edit, setEdit] = useState<Partial<Account> | null>(null);
  const [del, setDel] = useState<Account | null>(null);

  const rows = useMemo(() => {
    const all = accounts.data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle && inactive) return all;
    const match = (a: Account) => (inactive || a.is_active) && (!needle || a.code.startsWith(needle) || a.name.toLowerCase().includes(needle));
    const keep = new Set<number>();
    const byId = new Map(all.map((a) => [a.id, a]));
    for (const a of all) if (match(a)) { let cur: Account | undefined = a; while (cur) { keep.add(cur.id); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; } }
    return all.filter((a) => keep.has(a.id));
  }, [accounts.data, q, inactive]);
  const tree = useMemo(() => buildTree(rows), [rows]);
  const toggle = (id: number) => setCollapsed((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const flat: { node: Node; depth: number }[] = [];
  const walk = (ns: Node[], depth: number) => ns.forEach((n) => { flat.push({ node: n, depth }); if (!collapsed.has(n.id) || q) walk(n.children, depth + 1); });
  walk(tree, 0);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Kod yoki nom…" />
        <Toggle label="Nofaollarni ko'rsatish" checked={inactive} onChange={setInactive} />
        {can.create && <Button className="ml-auto" onClick={() => setEdit({ kind: "asset", is_active: true, allow_posting: true, parent_id: null })}><Plus className="size-4" /> Hisob qo'shish</Button>}
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3 font-medium">Hisob</th>
              <th className="px-4 py-3 font-medium">Turi</th>
              <th className="px-4 py-3 font-medium">Rollar</th>
              <th className="px-4 py-3 font-medium">Holat</th>
              {can.update && <th className="w-24" />}
            </tr>
          </thead>
          <tbody>
            {flat.map(({ node: a, depth }) => (
              <tr key={a.id} className={`border-b border-line last:border-0 ${a.allow_posting ? "" : "bg-ground/50"} ${a.is_active ? "" : "opacity-55"}`}>
                <td className="px-4 py-2" style={{ paddingLeft: 16 + depth * 22 }}>
                  <span className="inline-flex items-center gap-1.5">
                    {a.children.length > 0 ? (
                      <button type="button" onClick={() => toggle(a.id)} className="grid size-5 place-items-center rounded text-muted hover:bg-sunk hover:text-ink" aria-label="Ochish/yopish">
                        {collapsed.has(a.id) && !q ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      </button>
                    ) : <span className="size-5" />}
                    <b className="font-mono">{a.code}</b>
                    <span className={a.allow_posting ? "" : "font-semibold"}>{a.name}</span>
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-xs text-muted">{KIND_LABEL[a.kind]}</td>
                <td className="px-4 py-2"><span className="flex flex-wrap gap-1">{a.roles.map((r) => <Pill key={r} tone="accent">{r}</Pill>)}</span></td>
                <td className="whitespace-nowrap px-4 py-2 text-xs">
                  {!a.allow_posting ? <span className="text-muted">guruh</span> : <ActivePill active={a.is_active} />}
                  {a.has_lines && <span className="ml-1.5 text-muted" title="O'tkazmalar bor">· o'tkazmalar bor</span>}
                </td>
                {can.update && (
                  <td className="px-2 py-1">
                    <span className="flex justify-end">
                      <button type="button" onClick={() => setEdit(a)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-sunk hover:text-ink" aria-label="Tahrirlash"><Pencil className="size-4" strokeWidth={1.75} /></button>
                      {can.delete && !a.has_lines && !a.children.length && !a.roles.length && (
                        <button type="button" onClick={() => setDel(a)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-sunk hover:text-bad" aria-label="O'chirish"><Trash2 className="size-4" strokeWidth={1.75} /></button>
                      )}
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {accounts.data && !flat.length && <p className="px-4 py-10 text-center text-sm text-muted">Topilmadi</p>}
      </div>
      <p className="mt-2 text-xs text-muted">Ishlatilgan hisob o'chirilmaydi — nofaol qilinadi. Hisob raqamlari o'zgarsa (NSFO 5), rollarni yangi hisobga biriktiring: kod o'zgarmaydi.</p>
      {edit && <AccountDialog initial={edit} accounts={accounts.data ?? []} busy={save.isPending} onClose={() => setEdit(null)}
        onSave={(data) => save.mutate({ id: edit.id, data }, { onSuccess: () => { setEdit(null); notifyOk("Saqlandi"); }, onError: notifyError })} />}
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title="Hisobni o'chirish" danger confirmLabel="O'chirish" busy={remove.isPending}
        text={`${del?.code} ${del?.name} o'chiriladi.`}
        onConfirm={() => del && remove.mutate(del.id, { onSuccess: () => { setDel(null); notifyOk("O'chirildi"); }, onError: notifyError })} />
    </>
  );
}

function AccountDialog({ initial, accounts, busy, onClose, onSave }: {
  initial: Partial<Account>; accounts: Account[]; busy: boolean; onClose: () => void; onSave: (data: AccountInput) => void;
}) {
  const [v, setV] = useState<AccountInput>({
    code: initial.code ?? "", name: initial.name ?? "", kind: initial.kind ?? "asset", parent_id: initial.parent_id ?? null,
    is_active: initial.is_active ?? true, allow_posting: initial.allow_posting ?? true,
  });
  const [err, setErr] = useState<string | null>(null);
  const groups = accounts.filter((a) => !a.allow_posting && a.id !== initial.id);
  const submit = () => {
    if (!/^\d{4}$/.test(v.code ?? "")) return setErr("Kod — 4 ta raqam");
    if (!v.name?.trim()) return setErr("Nomini yozing");
    onSave(v);
  };
  return (
    <Dialog open onClose={onClose} title={initial.id ? `${initial.code} — tahrirlash` : "Yangi hisob"}
      footer={<><Button variant="ghost" onClick={onClose}>Bekor qilish</Button><Button busy={busy} onClick={submit}>Saqlash</Button></>}>
      <div className="grid grid-cols-[110px_1fr] gap-3">
        <Field label="Kod" required><Input className="font-mono" value={v.code} maxLength={4} onChange={(e) => setV({ ...v, code: e.target.value })} /></Field>
        <Field label="Nomi" required><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
      </div>
      <Field label="Turi">
        <Select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as AccountKind })}>
          {(Object.keys(KIND_LABEL) as AccountKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </Select>
      </Field>
      <Field label="Guruh">
        <Select value={v.parent_id ?? ""} onChange={(e) => setV({ ...v, parent_id: e.target.value ? Number(e.target.value) : null })}>
          <option value="">— yo'q —</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.code} {g.name}</option>)}
        </Select>
      </Field>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Toggle label="O'tkazma qilinadi (guruh emas)" checked={!!v.allow_posting} onChange={(x) => setV({ ...v, allow_posting: x })} />
        <Toggle label="Faol" checked={!!v.is_active} onChange={(x) => setV({ ...v, is_active: x })} />
      </div>
      <ErrorNote error={err} />
    </Dialog>
  );
}

// ------------------------------------------------------------------ roles

function RolesTab() {
  const can = useCan("accounts");
  const roles = useRoles();
  const accounts = useAccounts({ is_active: "true", allow_posting: "true" });
  const setRole = useSetRole();
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-[var(--shadow-card)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
            <th className="px-4 py-3 font-medium">Rol</th>
            <th className="px-4 py-3 font-medium">Kalit</th>
            <th className="w-[26rem] px-4 py-3 font-medium">Hisob</th>
          </tr>
        </thead>
        <tbody>
          {(roles.data ?? []).map((r) => (
            <tr key={r.id} className="border-b border-line last:border-0">
              <td className="px-4 py-2 font-medium">{r.label}</td>
              <td className="px-4 py-2 font-mono text-xs text-muted">{r.key}</td>
              <td className="px-4 py-1.5">
                {can.update ? (
                  <Select value={r.account.id} onChange={(e) => setRole.mutate({ id: r.id, account_id: Number(e.target.value) }, { onSuccess: () => notifyOk(`${r.key} → ${(accounts.data ?? []).find((a) => a.id === Number(e.target.value))?.code}`), onError: notifyError })}>
                    {!(accounts.data ?? []).some((a) => a.id === r.account.id) && <option value={r.account.id}>{r.account.code} {r.account.name}</option>}
                    {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                  </Select>
                ) : <span><b className="font-mono">{r.account.code}</b> <span className="text-muted">{r.account.name}</span></span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line px-4 py-2.5 text-xs text-muted">O'tkazma qoidalari hisob raqamini emas, rolni biladi. Rolni boshqa hisobga o'tkazsangiz, keyingi hujjatlar yangi hisobga yoziladi; eski o'tkazmalar o'zgarmaydi.</p>
    </div>
  );
}

// ------------------------------------------------------------------ rates

function RatesTab() {
  const can = useCan("accounts");
  const [page, setPage] = useState(1);
  const list = ratesApi.useList({ page, size: 31, sort: "-date" });
  const save = ratesApi.useSave();
  const remove = ratesApi.useRemove();
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [rate, setRate] = useState("");
  const total = list.data?.total ?? 0;
  const last = Math.max(1, Math.ceil(total / 31));
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
      <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3 font-medium">Sana</th><th className="px-4 py-3 font-medium">Valyuta</th>
              <th className="px-4 py-3 text-right font-medium">Kurs, so'm</th><th className="px-4 py-3 font-medium">Manba</th>{can.delete && <th className="w-12" />}
            </tr>
          </thead>
          <tbody>
            {(list.data?.items ?? []).map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="whitespace-nowrap px-4 py-2">{fmtDate(r.date)}</td>
                <td className="px-4 py-2">{r.currency}</td>
                <td className="px-4 py-2 text-right tabular font-medium">{money(r.rate)}</td>
                <td className="px-4 py-2 text-xs text-muted">{r.source === "cbu" ? "Markaziy bank" : "Qo'lda"}</td>
                {can.delete && <td className="px-2"><button type="button" onClick={() => remove.mutate(r.id, { onError: notifyError })} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-sunk hover:text-bad" aria-label="O'chirish"><Trash2 className="size-4" strokeWidth={1.75} /></button></td>}
              </tr>
            ))}
          </tbody>
        </table>
        {list.data && !list.data.items.length && <p className="px-4 py-10 text-center text-sm text-muted">Hali kurs kiritilmagan</p>}
        {total > 31 && (
          <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-2 text-xs">
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Oldingi</Button>
            <span className="tabular text-muted">{page} / {last}</span>
            <Button size="sm" variant="ghost" disabled={page >= last} onClick={() => setPage(page + 1)}>Keyingi</Button>
          </div>
        )}
      </div>
      <div className="grid content-start gap-3 rounded-xl border border-line bg-surface p-4">
        <p className="t-label">USD kursi kiritish</p>
        <Field label="Sana"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!can.update} /></Field>
        <Field label="Kurs, so'm" hint="Shu kundagi hujjatlar shu kurs bilan so'mga o'giriladi"><Input inputMode="decimal" className="tabular" placeholder="12 050.50" value={rate} onChange={(e) => setRate(e.target.value)} disabled={!can.update} /></Field>
        {can.update && (
          <Button busy={save.isPending} disabled={!rate || !date} onClick={() => save.mutate({ data: { date, currency: "USD", rate: rate.replace(/\s/g, "").replace(",", ".") } }, {
            onSuccess: () => { notifyOk("Kurs saqlandi"); setRate(""); }, onError: (e) => notifyError(e),
          })}>Saqlash</Button>
        )}
        <p className="text-xs text-muted">Har kuni avtomatik: serverda <code className="font-mono">manage.py fetch_cbu_rates</code> (Markaziy bank API). Qo'lda kiritilgan kurs avtomatik yangilanmaydi.</p>
        {save.error && <ErrorNote error={apiError(save.error).message} />}
      </div>
    </div>
  );
}

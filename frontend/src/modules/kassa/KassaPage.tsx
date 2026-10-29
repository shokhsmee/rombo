import { ArrowLeftRight, Landmark, Pencil, Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { EntitySelect } from "@/components/EntitySelect";
import { PageHeader } from "@/components/PageHeader";
import { ActivePill } from "@/components/Status";
import { Button, Dialog, Empty, Field, Input, Kpi, Pill, Segmented, Select, Spinner, Toggle } from "@/components/ui";
import { apiError } from "@/lib/api";
import { toNum } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { useAccounts, useRoles, type Currency } from "@/modules/accounting/api";
import { money } from "@/modules/accounting/labels";

import {
  useCashAccounts, useCashAccountSave, useKassaSummary, usePurposeActions, usePurposes,
  type AccountKind, type CashAccount, type CashAccountInput, type Direction, type Posting, type Purpose, type PurposeInput,
} from "./api";
import { ACCOUNT_KIND, DIRECTION, POSTING, unit } from "./labels";

type Tab = "accounts" | "purposes";

/** Kassa va bank: every account with its live ledger balance, the KPI row, and the payment purposes. */
export function KassaPage() {
  const can = useCan("kassa");
  const canOrders = useCan("cash_orders");
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get("tab") as Tab | null) ?? "accounts";
  const summary = useKassaSummary();
  const [edit, setEdit] = useState<CashAccount | "new" | null>(null);
  const s = summary.data;

  return (
    <>
      <PageHeader title="Kassa va bank" lede="Har bir kassa va bank hisobining qoldig'i — jurnaldagi o'tkazmalardan. Pul harakati faqat kirim / chiqim orderlari bilan."
        action={<>
          {canOrders.create && (
            <Link to="/kassa/orders/new?kind=in" className="press inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-ink">
              <Plus className="size-4" /> Kirim
            </Link>
          )}
          {canOrders.create && <Button variant="ghost" onClick={() => navigate("/kassa/orders/new?kind=out")}>Chiqim</Button>}
          {canOrders.create && <Button variant="ghost" onClick={() => navigate("/kassa/orders/new?kind=transfer")}><ArrowLeftRight className="size-4" strokeWidth={1.75} /> O'tkazma</Button>}
        </>} />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Jami pul, so'm" value={money(s?.total_uzs)} />
        <Kpi label="Kassalarda" value={money(s?.cash_uzs)} />
        <Kpi label="Bankda" value={money(s?.bank_uzs)} />
        <Kpi label="Shu oy kirim" value={money(s?.month_in)} tone="text-ok" sub={s && Number(s.today_in) ? `bugun ${money(s.today_in)}` : undefined} />
        <Kpi label="Shu oy chiqim" value={money(s?.month_out)} tone="text-bad" sub={s && Number(s.today_out) ? `bugun ${money(s.today_out)}` : undefined} />
        <Kpi label="Qoralamalar" value={s?.drafts ?? "—"} onClick={canOrders.view ? () => navigate("/kassa/orders?status=draft") : undefined} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented value={tab} onChange={(t) => setSp({ tab: t }, { replace: true })}
          options={[{ value: "accounts", label: "Hisoblar" }, { value: "purposes", label: "To'lov maqsadlari" }]} />
        {tab === "accounts" && can.create && (
          <Button variant="soft" className="ml-auto" onClick={() => setEdit("new")}><Plus className="size-4" /> Yangi kassa / hisob</Button>
        )}
      </div>

      {tab === "accounts" ? <Accounts onEdit={can.update ? setEdit : undefined} /> : <Purposes canEdit={can.update} />}
      {edit && <AccountDialog account={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function Accounts({ onEdit }: { onEdit?: (a: CashAccount) => void }) {
  const list = useCashAccounts();
  const canBook = useCan("cash_book");
  const canOrders = useCan("cash_orders");
  const navigate = useNavigate();
  if (!list.data) return <div className="grid place-items-center py-12 text-muted"><Spinner className="size-5" /></div>;
  if (!list.data.length) return <Empty>Hali kassa yo'q. «Yangi kassa / hisob» bilan qo'shing.</Empty>;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {list.data.map((a) => {
        const over = a.cash_limit != null && Number(a.balance) > Number(a.cash_limit);
        return (
          <div key={a.id} className={`grid gap-3 rounded-xl border bg-surface p-4 shadow-[var(--shadow-card)] ${a.is_active ? "border-line" : "border-dashed border-line opacity-70"}`}>
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink">
                {a.kind === "cash" ? <Wallet className="size-5" strokeWidth={1.75} /> : <Landmark className="size-5" strokeWidth={1.75} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold">{a.name}</h3>
                  {!a.is_active && <ActivePill active={false} />}
                </div>
                <p className="text-xs text-muted">{ACCOUNT_KIND[a.kind]} · {a.account.code} {a.account.name}{a.responsible && <> · {a.responsible.name}</>}</p>
                {a.kind === "bank" && (a.bank_name || a.account_number) && <p className="truncate text-xs text-muted">{a.bank_name}{a.mfo && ` · MFO ${a.mfo}`}{a.account_number && ` · ${a.account_number}`}</p>}
              </div>
              {onEdit && <button type="button" onClick={() => onEdit(a)} title="Tahrirlash" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-sunk hover:text-ink"><Pencil className="size-4" strokeWidth={1.75} /></button>}
            </div>
            <div>
              <p className={`text-2xl font-semibold tabular ${Number(a.balance) < 0 ? "text-bad" : ""}`}>{money(a.balance)} <span className="text-sm font-normal text-muted">{unit(a.currency)}</span></p>
              {a.currency !== "UZS" && <p className="text-xs text-muted">≈ {money(a.balance_uzs)} so'm</p>}
              {a.cash_limit != null && <p className={`text-xs ${over ? "font-medium text-warn" : "text-muted"}`}>Limit {money(a.cash_limit)}{over && " — limitdan oshdi"}</p>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {canOrders.view && <Button size="sm" variant="ghost" onClick={() => navigate(`/kassa/orders?account=${a.id}`)}>Orderlar</Button>}
              {canBook.view && <Button size="sm" variant="ghost" onClick={() => navigate(`/kassa/book?account=${a.id}`)}>Kassa kitobi</Button>}
              {canOrders.create && a.is_active && <Button size="sm" variant="soft" onClick={() => navigate(`/kassa/orders/new?kind=in&account=${a.id}`)}>+ Kirim</Button>}
              {canOrders.create && a.is_active && <Button size="sm" variant="soft" onClick={() => navigate(`/kassa/orders/new?kind=out&account=${a.id}`)}>− Chiqim</Button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type AccountValues = {
  name: string; kind: AccountKind; currency: Currency; account_id: number | null; bank_name: string; mfo: string;
  account_number: string; responsible_id: number | null; cash_limit: string; is_active: boolean;
};

function AccountDialog({ account, onClose }: { account: CashAccount | null; onClose: () => void }) {
  const save = useCashAccountSave();
  const chart = useAccounts({ allow_posting: "true", is_active: "true" });
  const [v, setV] = useState<AccountValues>(account ? {
    name: account.name, kind: account.kind, currency: account.currency, account_id: account.account.id, bank_name: account.bank_name,
    mfo: account.mfo, account_number: account.account_number, responsible_id: account.responsible?.id ?? null,
    cash_limit: account.cash_limit ? String(Number(account.cash_limit)) : "", is_active: account.is_active,
  } : { name: "", kind: "cash", currency: "UZS", account_id: null, bank_name: "", mfo: "", account_number: "", responsible_id: null, cash_limit: "", is_active: true });
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof AccountValues>(k: K, val: AccountValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const cashAccounts = (chart.data ?? []).filter((a) => a.code.startsWith("5"));
  const locked = !!account?.has_orders;

  const submit = () => {
    const data: CashAccountInput = {
      name: v.name.trim(), kind: v.kind, bank_name: v.bank_name, mfo: v.mfo, account_number: v.account_number,
      responsible_id: v.responsible_id, cash_limit: v.cash_limit ? String(toNum(v.cash_limit)) : null, is_active: v.is_active,
    };
    if (!locked) { data.currency = v.currency; data.account_id = v.account_id; }
    save.mutate({ id: account?.id, data }, {
      onSuccess: () => { notifyOk("Saqlandi"); onClose(); },
      onError: (e) => setError(apiError(e).message),
    });
  };

  return (
    <Dialog open onClose={onClose} title={account ? account.name : "Yangi kassa / hisob"} width="max-w-lg"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
        <Button busy={save.isPending} disabled={v.name.trim().length < 2} onClick={submit}>Saqlash</Button>
      </>}>
      {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm font-medium text-bad">{error}</p>}
      <Field label="Nomi" required><Input autoFocus value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Asosiy kassa, Ipoteka bank…" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Turi">
          <Select value={v.kind} disabled={locked} onChange={(e) => set("kind", e.target.value as AccountKind)}>
            <option value="cash">Kassa (naqd)</option><option value="bank">Bank hisobi</option>
          </Select>
        </Field>
        <Field label="Valyuta">
          <Select value={v.currency} disabled={locked} onChange={(e) => set("currency", e.target.value as Currency)}>
            <option value="UZS">so'm</option><option value="USD">USD</option>
          </Select>
        </Field>
      </div>
      <Field label="Buxgalteriya hisobi" hint={locked ? "Orderlar bor — hisob o'zgarmaydi" : "Bo'sh qolsa turi va valyutasi bo'yicha (5010 / 5020 / 5110 / 5210) tanlanadi; har bir kassaning o'z hisobi bo'ladi"}>
        <Select value={v.account_id ?? ""} disabled={locked} onChange={(e) => set("account_id", e.target.value ? Number(e.target.value) : null)}>
          <option value="">— avtomatik —</option>
          {cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
        </Select>
      </Field>
      {v.kind === "bank" && (
        <div className="grid grid-cols-[1fr_100px] gap-3">
          <Field label="Bank"><Input value={v.bank_name} onChange={(e) => set("bank_name", e.target.value)} /></Field>
          <Field label="MFO"><Input value={v.mfo} onChange={(e) => set("mfo", e.target.value)} className="font-mono" /></Field>
          <Field label="Hisob raqami" className="col-span-2"><Input value={v.account_number} onChange={(e) => set("account_number", e.target.value)} className="font-mono" /></Field>
        </div>
      )}
      <Field label={v.kind === "cash" ? "Kassir (mas'ul)" : "Mas'ul"}>
        <EntitySelect endpoint="employees" current={account?.responsible} extraParams={{ status: "active" }} value={v.responsible_id} onChange={(id) => set("responsible_id", id)} />
      </Field>
      {v.kind === "cash" && (
        <Field label="Kassa limiti" hint="Bank bilan kelishilgan limit; oshsa kassa kitobida ogohlantiradi, to'xtatmaydi">
          <Input inputMode="decimal" className="tabular" value={v.cash_limit} onChange={(e) => set("cash_limit", e.target.value)} />
        </Field>
      )}
      {account && <Toggle label="Faol" checked={v.is_active} onChange={(x) => set("is_active", x)} />}
    </Dialog>
  );
}

// ------------------------------------------------------------------ purposes

function Purposes({ canEdit }: { canEdit: boolean }) {
  const purposes = usePurposes();
  const [edit, setEdit] = useState<Purpose | "new" | null>(null);
  if (!purposes.data) return <div className="grid place-items-center py-12 text-muted"><Spinner className="size-5" /></div>;
  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted">Maqsad o'tkazmani belgilaydi: mijoz / yetkazib beruvchi — qarz, keyin avans; qolganlari — ko'rsatilgan hisobga.</p>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3 font-medium">Nomi</th><th className="px-4 py-3 font-medium">Yo'nalish</th>
              <th className="px-4 py-3 font-medium">O'tkazma</th><th className="px-4 py-3 font-medium">Talab</th><th className="px-4 py-3 font-medium">Holat</th>
            </tr>
          </thead>
          <tbody>
            {purposes.data.map((p) => (
              <tr key={p.id} onClick={canEdit ? () => setEdit(p) : undefined} className={`border-b border-line last:border-0 ${canEdit ? "cursor-pointer hover:bg-ground" : ""}`}>
                <td className="px-4 py-2.5 font-medium">{p.name}</td>
                <td className="px-4 py-2.5"><Pill tone={p.direction === "in" ? "ok" : p.direction === "out" ? "bad" : "neutral"}>{DIRECTION[p.direction]}</Pill></td>
                <td className="px-4 py-2.5 text-muted">{p.posting === "account" ? <span className="font-mono text-xs">{p.account_role}</span> : POSTING[p.posting]}</td>
                <td className="px-4 py-2.5 text-xs text-muted">{[p.requires_partner && "kontragent", p.requires_employee && "xodim"].filter(Boolean).join(", ") || "—"}</td>
                <td className="px-4 py-2.5"><ActivePill active={p.is_active} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit && <Button variant="soft" className="justify-self-start" onClick={() => setEdit("new")}><Plus className="size-4" /> Yangi maqsad</Button>}
      {edit && <PurposeDialog purpose={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function PurposeDialog({ purpose, onClose }: { purpose: Purpose | null; onClose: () => void }) {
  const { save, remove } = usePurposeActions();
  const roles = useRoles();
  const [v, setV] = useState<Required<PurposeInput>>(purpose ? { ...purpose } : {
    name: "", direction: "out", posting: "account", account_role: "admin_expense", requires_partner: false, requires_employee: false, is_active: true, sort_order: 900,
  });
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof PurposeInput>(k: K, val: Required<PurposeInput>[K]) => setV((p) => ({ ...p, [k]: val }));
  return (
    <Dialog open onClose={onClose} title={purpose ? purpose.name : "Yangi to'lov maqsadi"}
      footer={<>
        {purpose && <Button variant="danger" className="mr-auto" busy={remove.isPending} onClick={() => remove.mutate(purpose.id, { onSuccess: onClose, onError: notifyError })}>O'chirish</Button>}
        <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
        <Button busy={save.isPending} disabled={v.name.trim().length < 2} onClick={() => save.mutate({ id: purpose?.id, data: v }, { onSuccess: () => { notifyOk("Saqlandi"); onClose(); }, onError: (e) => setError(apiError(e).message) })}>Saqlash</Button>
      </>}>
      {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm font-medium text-bad">{error}</p>}
      <Field label="Nomi" required><Input autoFocus value={v.name} onChange={(e) => set("name", e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Yo'nalish">
          <Select value={v.direction} onChange={(e) => set("direction", e.target.value as Direction)}>
            {(Object.keys(DIRECTION) as Direction[]).map((d) => <option key={d} value={d}>{DIRECTION[d]}</option>)}
          </Select>
        </Field>
        <Field label="O'tkazma qoidasi">
          <Select value={v.posting} onChange={(e) => set("posting", e.target.value as Posting)}>
            {(Object.keys(POSTING) as Posting[]).map((p) => <option key={p} value={p}>{POSTING[p]}</option>)}
          </Select>
        </Field>
      </div>
      {v.posting === "account" && (
        <Field label="Hisob roli" hint="Kirimda Kt, chiqimda Dt shu hisobga">
          <Select value={v.account_role} onChange={(e) => set("account_role", e.target.value)}>
            {(roles.data ?? []).map((r) => <option key={r.key} value={r.key}>{r.account.code} · {r.label}</option>)}
          </Select>
        </Field>
      )}
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Toggle label="Kontragent majburiy" checked={v.requires_partner || v.posting !== "account"} disabled={v.posting !== "account"} onChange={(x) => set("requires_partner", x)} />
        <Toggle label="Xodim majburiy" checked={v.requires_employee} onChange={(x) => set("requires_employee", x)} />
        <Toggle label="Faol" checked={v.is_active} onChange={(x) => set("is_active", x)} />
      </div>
    </Dialog>
  );
}

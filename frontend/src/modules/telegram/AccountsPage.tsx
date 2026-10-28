// Telegram accounts (ported from uzbridge telegram/Accounts.tsx): add your own Telegram (phone → code → 2FA),
// what new private chats do, sync, disconnect. A manager also sees colleagues' accounts — never their chats.
import { useState } from "react";
import { Link } from "react-router-dom";

import { Button, ConfirmDialog, Dialog, Input, Pill, Toggle } from "@/components/ui";
import { notifyError, notifyOk } from "@/lib/notify";

import { TG_STATUS, useAccountAction, useAccounts, type Account } from "./api";

export function AccountsPage() {
  const q = useAccounts();
  const [adding, setAdding] = useState(false);
  const [wizard, setWizard] = useState<Account | null>(null);
  const d = q.data;
  if (!d) return null;
  const mine = d.accounts.filter((a) => a.mine);
  const others = d.accounts.filter((a) => !a.mine);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">
          O'z Telegram akkauntingizni ulang: mijozlarga shu yerdan yozasiz, yangi shaxsiy chat avtomatik mijoz (va xohlasangiz lid) bo'ladi.
          Xabarlar matni Rombo'da saqlanmaydi — Telegramdan jonli o'qiladi. Doimiy ulanish uchun serverda <code>manage.py telegram_listen</code> ishlashi kerak.
        </p>
        <Button onClick={() => setAdding(true)}>+ Akkaunt qo'shish</Button>
      </div>
      {!d.default_api && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">Serverda TELEGRAM_API_ID / TELEGRAM_API_HASH yo'q — har akkaunt o'z API ID va Hash'ini (my.telegram.org) kiritadi.</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {mine.map((a) => <AccountCard key={a.id} a={a} crm={d.crm} onConnect={() => setWizard(a)} />)}
        {!mine.length && <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">Hali akkaunt yo'q.</p>}
      </div>
      {d.can_manage && others.length > 0 && (
        <section className="grid gap-2">
          <h2 className="t-h2">Hamkasblar akkauntlari</h2>
          {others.map((a) => <ColleagueCard key={a.id} a={a} />)}
        </section>
      )}
      {adding && <AddDialog defaultApi={d.default_api} crm={d.crm} onClose={() => setAdding(false)} onCreated={(a) => { setAdding(false); setWizard(a); }} />}
      {wizard && <ConnectWizard a={wizard} onClose={() => setWizard(null)} />}
    </div>
  );
}

function AccountCard({ a, crm, onConnect }: { a: Account; crm: boolean; onConnect: () => void }) {
  const act = useAccountAction();
  const [del, setDel] = useState(false);
  const put = (body: Record<string, unknown>) => act.mutate({ id: a.id, action: "update", body }, { onError: notifyError });
  return (
    <div className="card grid gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="w-48" defaultValue={a.name} onBlur={(e) => e.target.value.trim() && e.target.value !== a.name && put({ name: e.target.value.trim() })} />
        <span className="text-sm text-muted">{a.phone}{a.tg_username && ` · @${a.tg_username}`}</span>
        <Pill tone={a.connected ? "ok" : a.status === "error" ? "bad" : "warn"}>{TG_STATUS[a.status]}</Pill>
        {a.connected && <Pill tone={a.live ? "ok" : "neutral"}>{a.live ? "jonli" : "listener ishlamayapti"}</Pill>}
      </div>
      {a.error && <p className="rounded-md bg-bad-soft px-2 py-1 text-xs text-bad">{a.error}</p>}
      <Toggle label="Yangi shaxsiy chat — mijoz" checked={a.auto_clients} onChange={(x) => put({ auto_clients: x })} />
      {crm && <Toggle label="… va lid (CRM)" checked={a.crm_leads} onChange={(x) => put({ crm_leads: x })} />}
      <div className="flex flex-wrap gap-2">
        {a.connected ? <>
          <Link to="/telegram"><Button size="sm">Chatlar ({a.chats})</Button></Link>
          <Button size="sm" variant="ghost" busy={act.isPending} onClick={() => act.mutate({ id: a.id, action: "sync" }, { onSuccess: () => notifyOk("Yangilandi"), onError: notifyError })}>Yangilash</Button>
          <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: a.id, action: "disconnect" }, { onError: notifyError })}>Uzish</Button>
        </> : <Button size="sm" onClick={onConnect}>Ulash</Button>}
        <Button size="sm" variant="quiet" className="ml-auto text-bad" onClick={() => setDel(true)}>O'chirish</Button>
      </div>
      <ConfirmDialog open={del} onClose={() => setDel(false)} danger title="Akkauntni o'chirish" confirmLabel="O'chirish" busy={act.isPending}
        text="Telegram sessiyasi yopiladi, chatlar ro'yxati o'chiriladi. Mijozlar va lidlar qoladi."
        onConfirm={() => act.mutate({ id: a.id, action: "delete" }, { onSuccess: () => setDel(false), onError: notifyError })} />
    </div>
  );
}

function ColleagueCard({ a }: { a: Account }) {
  const act = useAccountAction();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
      <b>{a.owner.full_name}</b><span className="text-muted">{a.name} · {a.phone}</span>
      <Pill tone={a.connected ? "ok" : "neutral"}>{TG_STATUS[a.status]}</Pill>
      <span className="text-xs text-muted">{a.chats} chat</span>
      <span className="ml-auto flex gap-2">
        {a.connected && <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: a.id, action: "disconnect" }, { onError: notifyError })}>Uzish</Button>}
        <Button size="sm" variant="quiet" className="text-bad" onClick={() => act.mutate({ id: a.id, action: "delete" }, { onError: notifyError })}>O'chirish</Button>
      </span>
    </div>
  );
}

function AddDialog({ defaultApi, crm, onClose, onCreated }: { defaultApi: boolean; crm: boolean; onClose: () => void; onCreated: (a: Account) => void }) {
  const act = useAccountAction();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [own, setOwn] = useState(!defaultApi);
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [leads, setLeads] = useState(false);
  return (
    <Dialog open onClose={onClose} title="Telegram akkaunt qo'shish"
      footer={<><Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
        <Button busy={act.isPending} disabled={!phone.trim()} onClick={() => act.mutate({ action: "create", body: {
          phone, name, crm_leads: leads, ...(own ? { api_id: Number(apiId) || null, api_hash: apiHash } : {}),
        } }, { onSuccess: (a) => onCreated(a as Account), onError: notifyError })}>Davom etish</Button></>}>
      <label className="grid gap-1 text-sm"><span className="text-muted">Telefon</span><Input placeholder="+998 90 123 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      <label className="grid gap-1 text-sm"><span className="text-muted">Nomi (ixtiyoriy)</span><Input placeholder="Sotuv bo'limi" value={name} onChange={(e) => setName(e.target.value)} /></label>
      {crm && <Toggle label="Yangi chatlardan lid ochilsin" checked={leads} onChange={setLeads} />}
      {defaultApi && <Toggle label="O'z API ID / Hash (my.telegram.org)" checked={own} onChange={setOwn} />}
      {own && <div className="grid gap-2 sm:grid-cols-2">
        <Input placeholder="API ID" inputMode="numeric" value={apiId} onChange={(e) => setApiId(e.target.value.replace(/\D/g, ""))} />
        <Input placeholder="API Hash" type="password" value={apiHash} onChange={(e) => setApiHash(e.target.value)} />
      </div>}
    </Dialog>
  );
}

function ConnectWizard({ a, onClose }: { a: Account; onClose: () => void }) {
  const act = useAccountAction();
  const [step, setStep] = useState<"start" | "code" | "password" | "done">(a.status === "password" ? "password" : a.status === "code_sent" ? "code" : "start");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const send = () => act.mutate({ id: a.id, action: "send-code" }, { onSuccess: () => setStep("code"), onError: notifyError });
  const signIn = () => act.mutate({ id: a.id, action: "sign-in", body: step === "password" ? { password } : { code } }, {
    onSuccess: (r) => setStep((r as { done: boolean }).done ? "done" : "password"), onError: notifyError,
  });
  return (
    <Dialog open onClose={onClose} title={`Telegram ulash · ${a.phone}`}>
      {step === "start" && <>
        <p className="text-sm text-muted">Telegram ilovangizga kod keladi.</p>
        <Button busy={act.isPending} onClick={send}>Kod yuborish</Button>
      </>}
      {step === "code" && <>
        <p className="text-sm text-muted">Telegramdan kelgan kodni kiriting.</p>
        <Input autoFocus inputMode="numeric" placeholder="12345" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && code && signIn()} />
        <div className="flex gap-2"><Button busy={act.isPending} disabled={!code} onClick={signIn}>Kirish</Button><Button variant="ghost" onClick={send}>Qayta yuborish</Button></div>
      </>}
      {step === "password" && <>
        <p className="text-sm text-muted">Akkauntda ikki bosqichli himoya bor — parolni kiriting.</p>
        <Input autoFocus type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && password && signIn()} />
        <Button busy={act.isPending} disabled={!password} onClick={signIn}>Kirish</Button>
      </>}
      {step === "done" && <>
        <p className="text-sm text-ok">Ulandi! Chatlar ro'yxati olindi.</p>
        <Link to="/telegram"><Button onClick={onClose}>Chatlarga o'tish</Button></Link>
      </>}
    </Dialog>
  );
}

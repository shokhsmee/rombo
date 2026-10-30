// Qo'ng'iroqlar: the call log with the day's numbers (ported from uzbridge crm/Telephony.tsx CallLog).
import dayjs from "dayjs";
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Settings2, UserPlus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { DataTable, Toolbar, type Column } from "@/components/DataTable";
import { BulkBar, ExcelMenu, useSelection } from "@/components/ListTools";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Button, Dialog, IconButton, Kpi, Pill, Segmented, Select, Textarea, Toggle } from "@/components/ui";
import { useListParams } from "@/hooks/useListParams";
import { notifyError, notifyOk } from "@/lib/notify";

import { CALL_STATUS, DIRECTION, callsApi, useCallStats, useCreateLeadFromCall, type Call, type CallStatus } from "./api";
import { dial, fmtDuration, fmtPhone } from "./live";

const PERIODS = { today: 0, week: 6, month: 29 } as const;
type Period = keyof typeof PERIODS;

export function CallsPage() {
  const can = useCan("telephony");
  const canLeads = useCan("crm");
  const navigate = useNavigate();
  const { params, update, query } = useListParams({ sort: "-started_at" }, ["status"]);
  const sel = useSelection(query);
  const f = params.filters;
  const period = (f.period as Period) || "today";
  const from = dayjs().subtract(PERIODS[period] ?? 0, "day").format("YYYY-MM-DD");
  const mine = f.mine === "true";
  const stats = useCallStats({ date_from: from, mine });
  const list = callsApi.useList({ ...query, period: undefined, date_from: from });
  const toLead = useCreateLeadFromCall();
  const [noteFor, setNoteFor] = useState<Call | null>(null);
  const s = stats.data;

  const columns: Column<Call>[] = [
    { key: "time", title: "Vaqt", sort: "started_at", className: "whitespace-nowrap text-xs tabular",
      render: (c) => <>{dayjs(c.started_at).format(period === "today" ? "HH:mm" : "DD.MM HH:mm")}</> },
    { key: "dir", title: "Qo'ng'iroq",
      render: (c) => {
        const Icon = c.status === "missed" ? PhoneMissed : c.direction === "out" ? PhoneOutgoing : PhoneIncoming;
        return (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Icon className={`size-4 ${c.status === "missed" ? "text-bad" : "text-muted"}`} strokeWidth={1.75} aria-label={DIRECTION[c.direction]} />
            <Pill tone={CALL_STATUS[c.status].tone}>{CALL_STATUS[c.status].label}</Pill>
          </div>
        );
      } },
    { key: "who", title: "Raqam",
      render: (c) => (
        <div className="min-w-44">
          <div className="font-medium tabular">{fmtPhone(c.client_phone) || c.from_number}</div>
          <div className="text-xs text-muted">
            {c.client?.name}
            {c.lead && <>{c.client && " · "}<Link to={`/crm/leads/${c.lead.id}`} onClick={(e) => e.stopPropagation()} className="text-accent-ink hover:underline">{c.lead.code} {c.lead.name}</Link></>}
          </div>
        </div>
      ) },
    { key: "user", title: "Xodim", className: "whitespace-nowrap text-xs", render: (c) => c.user?.full_name ?? (c.extension || <span className="text-muted">—</span>) },
    { key: "dur", title: "Davomiylik", sort: "duration", align: "right", className: "whitespace-nowrap tabular text-xs",
      render: (c) => (c.status === "answered" ? fmtDuration(c.duration) : "—") },
    { key: "rec", title: "Yozuv", render: (c) => (c.recording_url
      ? <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <audio controls preload="none" src={c.recording_url} className="h-8 w-48" />
          {c.recording_saved && <Pill tone="ok">Drive</Pill>}
          {c.recording_error && <span title={c.recording_error}><Pill tone="warn">!</Pill></span>}
        </div>
      : <span className="text-muted">—</span>) },
    { key: "note", title: "Natija", className: "max-w-60 text-xs", render: (c) => <span className="line-clamp-2">{c.note || <span className="text-muted">—</span>}</span> },
    { key: "act", title: "",
      render: (c) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {c.client_phone && <IconButton label="Qo'ng'iroq qilish" onClick={() => dial(c.client_phone)}><Phone className="size-4" strokeWidth={1.75} /></IconButton>}
          {!c.lead && c.client_phone && canLeads.create && can.update && (
            <IconButton label="Lid yaratish" onClick={() => toLead.mutate(c.id, { onSuccess: (r) => { notifyOk("Lid yaratildi"); if (r.lead) navigate(`/crm/leads/${r.lead.id}`); }, onError: notifyError })}>
              <UserPlus className="size-4" strokeWidth={1.75} />
            </IconButton>
          )}
        </div>
      ) },
  ];

  return (
    <>
      <PageHeader title="Qo'ng'iroqlar" lede="PBX va brauzer telefonidan kelgan qo'ng'iroqlar, lid va mijozlarga bog'langan."
        action={can.update && (
          <Link to="/telephony/settings"><Button variant="ghost"><Settings2 className="size-4" strokeWidth={1.75} /> Sozlamalar</Button></Link>
        )} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Kiruvchi" value={s?.incoming} />
        <Kpi label="Chiquvchi" value={s?.outgoing} />
        <Kpi label="Javob berildi" value={s?.answered} tone="text-ok" />
        <Kpi label="O'tkazib yuborildi" value={s?.missed} tone={s?.missed ? "text-bad" : ""}
          onClick={() => update({ filters: { status: ["missed"] } })} />
        <Kpi label="Qayta qo'ng'iroq kutmoqda" value={s?.missed_open} tone={s?.missed_open ? "text-bad" : ""} />
        <Kpi label="Suhbat vaqti" value={s ? fmtDuration(s.talk_seconds) : undefined} sub={s ? `${s.new_leads} yangi lid` : undefined} />
      </div>
      <Toolbar action={<ExcelMenu resource="telephony/calls" query={{ ...query, period: undefined, date_from: from }} selection={sel} />}>
        <Segmented value={period} onChange={(p) => update({ filters: { period: p === "today" ? null : p } })}
          options={[{ value: "today", label: "Bugun" }, { value: "week", label: "7 kun" }, { value: "month", label: "30 kun" }]} />
        <SearchInput value={params.q} onChange={(q) => update({ q })} placeholder="Raqam, mijoz, lid…" />
        <Select className="w-40" value={(f.direction as string) || ""} onChange={(e) => update({ filters: { direction: e.target.value || null } })}>
          <option value="">Yo'nalish: barchasi</option>
          <option value="in">Kiruvchi</option>
          <option value="out">Chiquvchi</option>
        </Select>
        <Select className="w-44" value={(f.status as string[] | undefined)?.[0] ?? ""} onChange={(e) => update({ filters: { status: e.target.value ? [e.target.value] : null } })}>
          <option value="">Holat: barchasi</option>
          {(Object.keys(CALL_STATUS) as CallStatus[]).map((k) => <option key={k} value={k}>{CALL_STATUS[k].label}</option>)}
        </Select>
        <Toggle label="Faqat meniki" checked={mine} onChange={(v) => update({ filters: { mine: v ? "true" : null } })} />
      </Toolbar>
      <BulkBar resource="telephony/calls" selection={sel} />
      <DataTable selected={sel.ids} onSelect={sel.set} columns={columns} data={list.data} loading={list.isFetching} params={params} onParams={update}
        onRowClick={(c) => (can.update ? setNoteFor(c) : c.lead && navigate(`/crm/leads/${c.lead.id}`))}
        empty="Bu davrda qo'ng'iroq yo'q" />
      {noteFor && <NoteDialog call={noteFor} onClose={() => setNoteFor(null)} />}
    </>
  );
}

function NoteDialog({ call, onClose }: { call: Call; onClose: () => void }) {
  const save = callsApi.useSave();
  const [note, setNote] = useState(call.note);
  return (
    <Dialog open onClose={onClose} title={`Qo'ng'iroq natijasi · ${fmtPhone(call.client_phone)}`}
      footer={<>
        {call.lead && <Link to={`/crm/leads/${call.lead.id}`} className="mr-auto self-center text-sm text-accent-ink hover:underline">{call.lead.code} lidini ochish →</Link>}
        <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
        <Button busy={save.isPending} onClick={() => save.mutate({ id: call.id, data: { note } }, { onSuccess: () => { notifyOk("Saqlandi"); onClose(); }, onError: notifyError })}>Saqlash</Button>
      </>}>
      <Textarea rows={4} autoFocus placeholder="Mijoz nima dedi, keyingi qadam…" value={note} onChange={(e) => setNote(e.target.value)} />
    </Dialog>
  );
}

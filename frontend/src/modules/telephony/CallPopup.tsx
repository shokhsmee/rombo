// Incoming call card (ported from uzbridge crm/CallPopup.tsx): who is calling (client, open lead) while it rings;
// after the call a result note and quick actions. Calls arrive over the live socket (pushed to their operator);
// while the socket is down the popup asks /telephony/calls/live/ every 5 s instead.
import { useMutation, useQuery } from "@tanstack/react-query";
import { PhoneIncoming, PhoneOutgoing, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { api } from "@/lib/api";
import { liveEvents, useLiveConnected } from "@/lib/live";
import { notifyError } from "@/lib/notify";

import { useCreateLeadFromCall, useMyPhone, type Call } from "./api";
import { fmtDuration, fmtPhone } from "./live";

const DONE: Record<string, string> = {
  answered: "Suhbat tugadi", missed: "O'tkazib yuborildi", no_answer: "Javob berilmadi", busy: "Band", failed: "Ulanmadi",
};

export function CallPopup() {
  const me = useMyPhone(true);
  const connected = useLiveConnected();
  const hasExtension = !!me.data?.enabled && !!me.data.phone;
  const [calls, setCalls] = useState<Call[]>([]);
  const upsert = (c: Call) => {
    if (c.direction === "internal") return;
    setCalls((list) => {
      const known = list.some((x) => x.id === c.id);
      if (!known && !c.live) return list; // an ended call we never saw ringing is not news
      return known ? list.map((x) => (x.id === c.id ? c : x)) : [c, ...list].slice(0, 3);
    });
  };
  useEffect(() => liveEvents.on((m) => { if (m.type === "call") upsert(m.call as Call); }), []);
  const poll = useQuery({
    queryKey: ["telephony/calls", "live"],
    queryFn: async () => (await api.get<Call[]>("/telephony/calls/live/")).data,
    enabled: hasExtension && !connected,
    refetchInterval: 5000,
  });
  useEffect(() => { poll.data?.forEach(upsert); }, [poll.data]);
  if (!calls.length || me.data?.popup === false) return null;
  const close = (id: number) => setCalls((l) => l.filter((c) => c.id !== id));
  return (
    <div className="fixed right-4 top-16 z-[70] flex w-80 flex-col gap-2">
      {calls.map((c) => <CallCard key={c.id} call={c} onClose={() => close(c.id)} onUpdated={upsert} />)}
    </div>
  );
}

function CallCard({ call, onClose, onUpdated }: { call: Call; onClose: () => void; onUpdated: (c: Call) => void }) {
  const navigate = useNavigate();
  const canLead = useCan("crm").create;
  const canNote = useCan("telephony").update;
  const [note, setNote] = useState("");
  const [, tick] = useState(0);
  useEffect(() => {
    if (!call.live) return;
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [call.live]);
  const save = useMutation({ mutationFn: () => api.patch(`/telephony/calls/${call.id}/`, { note }), onSuccess: onClose, onError: notifyError });
  const toLead = useCreateLeadFromCall();
  const open = (id: number) => { onClose(); navigate(`/crm/leads/${id}`); };

  const since = new Date(call.answered_at ?? call.started_at).getTime();
  const head = call.live
    ? call.status === "ringing" ? (call.direction === "in" ? "Kiruvchi qo'ng'iroq" : "Chaqirilmoqda") : `Suhbat · ${fmtDuration(Math.max(0, Math.round((Date.now() - since) / 1000)))}`
    : `${DONE[call.status] ?? "Tugadi"}${call.status === "answered" ? ` · ${fmtDuration(call.duration)}` : ""}`;
  const edge = call.live ? (call.status === "ringing" ? "border-ok" : "border-accent") : call.status === "answered" ? "border-line" : "border-bad";
  const Icon = call.direction === "out" ? PhoneOutgoing : PhoneIncoming;
  return (
    <div className={`anim-pop overflow-hidden rounded-xl border-2 bg-surface shadow-[var(--shadow-pop)] ${edge}`}>
      <div className="flex items-start gap-3 p-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-full text-white ${call.live ? "animate-pulse bg-ok" : call.status === "answered" ? "bg-accent" : "bg-bad"}`}>
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="t-label">{head}</p>
          <p className="truncate text-base font-bold">{call.client?.name ?? fmtPhone(call.client_phone)}</p>
          {call.client && <p className="text-xs tabular text-muted">{fmtPhone(call.client_phone)}</p>}
          {call.lead
            ? <button type="button" onClick={() => open(call.lead!.id)} className="mt-1 block max-w-full truncate rounded-md bg-accent-soft px-2 py-0.5 text-left text-xs font-semibold text-accent-ink hover:underline">{call.lead.code} · {call.lead.name}</button>
            : <p className="mt-1 text-xs text-muted">{call.client ? "Ochiq lid yo'q" : "Yangi raqam — CRMda yo'q"}</p>}
        </div>
        <button type="button" onClick={onClose} className="text-muted hover:text-ink" aria-label="Yopish"><X className="size-4" /></button>
      </div>
      {(call.lead || (canLead && call.client_phone)) && (
        <div className="flex gap-2 border-t border-line bg-ground/60 px-3 py-2">
          {call.lead
            ? <button type="button" onClick={() => open(call.lead!.id)} className="h-8 flex-1 rounded-lg bg-accent text-xs font-semibold text-white">Lidni ochish</button>
            : <button type="button" disabled={toLead.isPending}
                onClick={() => toLead.mutate(call.id, { onSuccess: (r) => { onUpdated(r); if (r.lead) open(r.lead.id); }, onError: notifyError })}
                className="h-8 flex-1 rounded-lg bg-accent text-xs font-semibold text-white disabled:opacity-50">+ Lid yaratish</button>}
        </div>
      )}
      {!call.live && canNote && (
        <div className="flex gap-2 border-t border-line px-3 py-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && note.trim() && save.mutate()}
            placeholder="Qo'ng'iroq natijasi…" className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-xs outline-none focus:border-accent" />
          <button type="button" onClick={() => save.mutate()} disabled={!note.trim() || save.isPending} className="rounded-lg border border-line px-2 text-xs disabled:opacity-40">Saqlash</button>
        </div>
      )}
    </div>
  );
}

// The calls of one lead, on its record page.
import dayjs from "dayjs";
import { PhoneIncoming, PhoneMissed, PhoneOutgoing } from "lucide-react";

import { Pill } from "@/components/ui";

import { CALL_STATUS, callsApi } from "./api";
import { fmtDuration, fmtPhone } from "./live";

export function LeadCalls({ leadId }: { leadId: number }) {
  const list = callsApi.useList({ lead: leadId, size: 20 });
  const items = list.data?.items ?? [];
  if (!items.length) return null;
  return (
    <section className="grid gap-2">
      <h2 className="t-h2">Qo'ng'iroqlar <span className="text-sm font-normal text-muted">{list.data?.total}</span></h2>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {items.map((c) => {
          const Icon = c.status === "missed" ? PhoneMissed : c.direction === "out" ? PhoneOutgoing : PhoneIncoming;
          return (
            <div key={c.id} className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-2.5 last:border-0">
              <Icon className={`size-4 ${c.status === "missed" ? "text-bad" : "text-muted"}`} strokeWidth={1.75} />
              <span className="text-xs tabular text-muted">{dayjs(c.started_at).format("DD.MM HH:mm")}</span>
              <span className="tabular">{fmtPhone(c.client_phone)}</span>
              <Pill tone={CALL_STATUS[c.status].tone}>{CALL_STATUS[c.status].label}</Pill>
              {c.status === "answered" && <span className="text-xs tabular">{fmtDuration(c.duration)}</span>}
              {c.user && <span className="text-xs text-muted">{c.user.full_name}</span>}
              {c.note && <span className="min-w-0 flex-1 truncate text-xs text-muted">{c.note}</span>}
              {c.recording_url && <audio controls preload="none" src={c.recording_url} className="ml-auto h-8 w-48" />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

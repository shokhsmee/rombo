import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { StatusMap } from "@/components/Status";
import { api, cleanParams, type Ref } from "@/lib/api";
import { crudResource } from "@/lib/crud";

export type CallDirection = "in" | "out" | "internal";
export type CallStatus = "ringing" | "talking" | "answered" | "missed" | "no_answer" | "busy" | "failed";

export type Call = {
  id: number;
  source: "webhook" | "softphone";
  direction: CallDirection;
  status: CallStatus;
  live: boolean;
  from_number: string;
  to_number: string;
  client_phone: string;
  extension: string;
  user: { id: number; full_name: string } | null;
  client: Ref | null;
  lead: { id: number; code: string; name: string; status: string } | null;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration: number;
  wait: number;
  recording_url: string;
  recording_saved: boolean;
  recording_error: string;
  connection: { id: number; name: string; kind: string } | null;
  note: string;
  created_lead: boolean;
};

export type CallStats = {
  incoming: number; outgoing: number; answered: number; missed: number; new_leads: number; talk_seconds: number;
  missed_open: number;
};

export type Extension = {
  id: number; user: { id: number; full_name: string }; user_id: number; number: string; connection_id: number | null;
  sip_login: string; has_password: boolean; softphone: boolean;
};

export type UnknownAction = "create_lead" | "create_contact" | "nothing";
export type TelephonySettings = {
  enabled: boolean; incoming_unknown: UnknownAction; missed_unknown: UnknownAction; outgoing_unknown: UnknownAction;
  duplicate: "open_lead" | "always_new" | "contact_only"; pipeline_id: number | null; stage_id: number | null;
  responsible: "operator" | "contact_owner" | "fixed"; fixed_manager_id: number | null; lead_title: string;
  source_id: number | null; tags: string[]; missed_task: boolean; missed_task_minutes: number; popup: boolean;
  min_duration: number;
};

export type MyPhone = {
  enabled: boolean;
  popup: boolean;
  phone: { extension: string; softphone: boolean; wss: string; domain: string; sip_login: string; sip_password: string; provider: string } | null;
};

// ------------------------------------------------------------------ connections (telephony and lead sources)

export type CatalogField = {
  key: string; label: string; type: "text" | "url" | "password" | "select" | "pipeline" | "stage" | "user";
  secret?: boolean; advanced?: boolean; transient?: boolean; default?: string; placeholder?: string; help?: string;
  options?: [string, string][];
};
export type CatalogKind = {
  kind: string; group: "telephony" | "leads"; name: string; webhook: string; tagline: string; howto: string; fields: CatalogField[];
};
export type Connection = {
  id: number; kind: string; kind_name: string; group: "telephony" | "leads"; name: string; enabled: boolean;
  config: Record<string, string | number | null>; secrets: Record<string, string>; webhook_url: string;
  status: "new" | "ok" | "error"; last_error: string; last_sync_at: string | null; last_event_at: string | null;
  events_count: number; created_at: string;
};
export type ConnectionInput = {
  kind?: string; name?: string; enabled?: boolean; config?: Record<string, unknown>; secrets?: Record<string, string>;
  clear_secrets?: string[];
};

export function useCatalog() {
  return useQuery({ queryKey: ["crm/connections", "catalog"], queryFn: async () => (await api.get<CatalogKind[]>("/crm/connections/catalog/")).data, staleTime: Infinity });
}

export function useConnections() {
  return useQuery({ queryKey: ["crm/connections"], queryFn: async () => (await api.get<Connection[]>("/crm/connections/")).data });
}

function useConnMutation<T, R>(fn: (b: T) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => qc.invalidateQueries({ queryKey: ["crm/connections"] }) });
}

export const useSaveConnection = () =>
  useConnMutation(async ({ id, data }: { id?: number; data: ConnectionInput }) =>
    (id ? await api.patch<Connection>(`/crm/connections/${id}/`, data) : await api.post<Connection>("/crm/connections/", data)).data as Connection);
export const useDeleteConnection = () => useConnMutation(async (id: number) => api.delete(`/crm/connections/${id}/`));
export const useConnectionAction = () =>
  useConnMutation(async ({ id, action, days }: { id: number; action: "check" | "sync" | "token"; days?: number }) =>
    (await api.post(`/crm/connections/${id}/${action}/`, undefined, { params: days ? { days } : {} })).data as Record<string, unknown>);

// ------------------------------------------------------------------ recordings (Google Drive)

export type RecordingsStatus = {
  configured: boolean; connected: boolean; email: string; enabled: boolean; folder_url: string; since: string | null;
  archived: number; pending: number; failed: number; with_recording: number;
};

export function useRecordings() {
  return useQuery({ queryKey: ["telephony/recordings"], queryFn: async () => (await api.get<RecordingsStatus>("/telephony/recordings/")).data, refetchInterval: 30_000 });
}

export function useRecordingsAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, ...body }: { action: "connect" | "switch" | "disconnect"; enabled?: boolean; back?: string }) =>
      (await api.post(`/telephony/recordings/`, body, { params: { do: action } })).data as RecordingsStatus & { url?: string },
    onSuccess: (r) => { if (!r.url) qc.setQueryData(["telephony/recordings"], r); },
  });
}

// ------------------------------------------------------------------ analytics

export type CallTotals = {
  calls: number; in: number; out: number; answered: number; missed: number; out_answered: number; talk_seconds: number;
  answer_rate: number | null; out_rate: number | null; avg_talk: number | null; avg_wait: number | null;
  missed_returned: number; missed_open: number; callback_minutes: number | null;
};
export type CallAnalytics = {
  totals: CallTotals;
  series: { day: string; in: number; out: number; missed: number; talk_seconds: number }[];
  heatmap: { calls: number[][]; missed: number[][] };
  employees: (Omit<CallTotals, "callback_minutes" | "avg_wait"> & { user_id: number | null; name: string })[];
  connections: { connection_id: number | null; name: string; calls: number; in: number; out: number; missed: number; talk_seconds: number }[];
  first_call: { leads: number; called: number; fast: number; median_minutes: number | null; fast_minutes: number };
};

export const callsApi = crudResource<Call, Call, { note?: string; lead_id?: number }>("telephony/calls");

export const CALL_STATUS: StatusMap<CallStatus> = {
  ringing: { label: "Jiringlamoqda", tone: "info" },
  talking: { label: "Suhbatda", tone: "accent" },
  answered: { label: "Javob berildi", tone: "ok" },
  missed: { label: "O'tkazib yuborildi", tone: "bad" },
  no_answer: { label: "Javob bermadi", tone: "warn" },
  busy: { label: "Band", tone: "warn" },
  failed: { label: "Ulanmadi", tone: "neutral" },
};

export const DIRECTION: Record<CallDirection, string> = { in: "Kiruvchi", out: "Chiquvchi", internal: "Ichki" };

export function useCallStats(params: { date_from?: string; date_to?: string; mine?: boolean }) {
  return useQuery({
    queryKey: ["telephony/calls", "stats", params],
    queryFn: async () => (await api.get<CallStats>("/telephony/calls/stats/", { params: cleanParams(params) })).data,
  });
}

export function useMyPhone(enabled: boolean) {
  return useQuery({
    queryKey: ["telephony/me"],
    queryFn: async () => (await api.get<MyPhone>("/telephony/me/")).data,
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

export function useCreateLeadFromCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.post<Call>(`/telephony/calls/${id}/lead/`)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: callsApi.keys.all }); qc.invalidateQueries({ queryKey: ["crm/leads"] }); },
  });
}

export function useDial() {
  return useMutation({ mutationFn: async (number: string) => (await api.post<{ ok: boolean; mobile?: boolean }>("/telephony/dial/", { number })).data });
}

export function useTelephonySettings() {
  return useQuery({ queryKey: ["telephony/settings"], queryFn: async () => (await api.get<TelephonySettings>("/telephony/settings/")).data });
}

export function useSaveTelephonySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<TelephonySettings>) => (await api.patch<TelephonySettings>("/telephony/settings/", data)).data,
    onSuccess: (s) => { qc.setQueryData(["telephony/settings"], s); qc.invalidateQueries({ queryKey: ["telephony/me"] }); },
  });
}

export function useExtensions() {
  return useQuery({ queryKey: ["telephony/extensions"], queryFn: async () => (await api.get<Extension[]>("/telephony/extensions/")).data });
}

export type ExtensionInput = { user_id: number | null; number: string; connection_id: number | null; sip_login: string; sip_password: string; softphone: boolean };

export function useSaveExtension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: number; data: ExtensionInput }) =>
      id ? (await api.patch<Extension>(`/telephony/extensions/${id}/`, data)).data : (await api.post<Extension>("/telephony/extensions/", data)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["telephony/extensions"] }); qc.invalidateQueries({ queryKey: ["telephony/me"] }); },
  });
}

export function useDeleteExtension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/telephony/extensions/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["telephony/extensions"] }),
  });
}

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
  note: string;
  created_lead: boolean;
};

export type CallStats = {
  incoming: number; outgoing: number; answered: number; missed: number; new_leads: number; talk_seconds: number;
  missed_open: number;
};

export type Extension = {
  id: number; user: { id: number; full_name: string }; user_id: number; number: string; sip_login: string;
  has_password: boolean; softphone: boolean;
};

export type TelephonySettings = {
  enabled: boolean; sip_wss: string; sip_domain: string; company_numbers: string; webhook_token: string;
  incoming_creates_lead: boolean; missed_creates_lead: boolean; missed_task: boolean; missed_task_minutes: number;
  last_event_at: string | null;
};

export type MyPhone = {
  enabled: boolean;
  phone: { extension: string; softphone: boolean; wss: string; domain: string; sip_login: string; sip_password: string } | null;
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

export function useRotateToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<TelephonySettings>("/telephony/settings/rotate-token/")).data,
    onSuccess: (s) => qc.setQueryData(["telephony/settings"], s),
  });
}

export function useExtensions() {
  return useQuery({ queryKey: ["telephony/extensions"], queryFn: async () => (await api.get<Extension[]>("/telephony/extensions/")).data });
}

export type ExtensionInput = { user_id: number | null; number: string; sip_login: string; sip_password: string; softphone: boolean };

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

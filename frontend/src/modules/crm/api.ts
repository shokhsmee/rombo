import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { StatusMap } from "@/components/Status";
import type { Tone } from "@/components/ui";
import { api, cleanParams, type Ref } from "@/lib/api";
import { crudResource } from "@/lib/crud";

export type LeadStatus = "open" | "won" | "lost";
export type FieldType = "text" | "number" | "date" | "select" | "phone" | "url" | "bool";
export type FieldSection = "deal" | "contact" | "extra";
export type FieldValue = string | number | boolean | null;

export type Stage = {
  id: number; pipeline_id: number; name: string; hint: string; position: number; tone: Tone;
  is_won: boolean; is_lost: boolean;
};
export type LostReason = { id: number; text: string; position: number };
export type Pipeline = {
  id: number; name: string; position: number; is_default: boolean; is_active: boolean; stages: Stage[];
  lost_reasons: LostReason[];
};

export type LeadCard = {
  id: number;
  code: string;
  title: string;
  pipeline_id: number;
  stage: Pick<Stage, "id" | "name" | "tone" | "is_won" | "is_lost">;
  status: LeadStatus;
  contact_name: string;
  phone: string;
  client: Ref | null;
  manager: Ref | null;
  source: { id: number; name: string } | null;
  budget: string;
  region: string;
  project: Ref | null;
  lost_reason: string;
  stage_changed_at: string;
  tags: string[];
  values: Record<string, FieldValue>;
  next_task_kind: string | null;
  next_task_text: string | null;
  next_task_due: string | null;
  open_tasks: number;
  calls_count: number;
  missed_calls: number;
  last_activity: string | null;
  last_activity_at: string | null;
  overdue: boolean;
  days_in_stage: number;
  dup: boolean;
  created_at: string;
  updated_at: string;
};

export type Duplicate = {
  id: number; code: string; title: string; pipeline: string; stage: string; stage_tone: Tone; manager: string | null;
  created_at: string;
};

export type Lead = LeadCard & {
  stage_id: number; client_id: number | null; manager_id: number | null; source_id: number | null;
  address: string; notes: string; duplicates: Duplicate[];
};

export type LeadInput = Partial<{
  title: string; contact_name: string; phone: string; client_id: number | null; manager_id: number | null;
  source_id: number | null; budget: string; region: string; address: string; notes: string; stage_id: number;
  tags: string[]; custom: Record<string, FieldValue>; auto_manager: boolean;
}>;

export type Task = {
  id: number; lead_id: number; lead: { id: number; code: string; name: string }; kind: string; text: string;
  due_at: string | null; assignee: { id: number; full_name: string } | null; assignee_id: number | null;
  done: boolean; done_at: string | null; created_at: string;
};

export type LeadField = {
  id: number; key: string; label: string; type: FieldType; section: FieldSection; options: string[];
  position: number; active: boolean;
};

export type CrmSettings = {
  task_types: string[]; card_fields: string[]; duplicates_enabled: boolean; distribution_enabled: boolean;
  distribution_mode: "round_robin" | "least_open"; distribution_managers: number[];
  me_employee?: number | null;
};

export type Board = { pipeline: { id: number; name: string }; stages: (Stage & { leads: LeadCard[] })[] };

export const leadsApi = crudResource<LeadCard, Lead, LeadInput>("crm/leads");
export const tasksApi = crudResource<Task, Task, Partial<Pick<Task, "kind" | "text" | "due_at" | "done" | "assignee_id" | "lead_id">>>("crm/tasks");

export const LEAD_STATUS: StatusMap<LeadStatus> = {
  open: { label: "Ochiq", tone: "accent" },
  won: { label: "Yutildi", tone: "ok" },
  lost: { label: "Rad etildi", tone: "bad" },
};

export const FIELD_TYPES: [FieldType, string][] = [
  ["text", "Matn"], ["number", "Son"], ["date", "Sana"], ["select", "Ro'yxat"], ["phone", "Telefon"], ["url", "Havola"],
  ["bool", "Ha / yo'q"],
];
export const SECTIONS: [FieldSection, string][] = [["deal", "Bitim"], ["contact", "Mijoz"], ["extra", "Qo'shimcha"]];

/** A stage tone as the dot / top edge of its column (tokens only). */
export const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-faint", accent: "bg-accent", info: "bg-info", warn: "bg-warn", done: "bg-done", ok: "bg-ok", bad: "bg-bad",
};

// ------------------------------------------------------------------ reads

export function usePipelines() {
  return useQuery({ queryKey: ["crm/pipelines"], queryFn: async () => (await api.get<Pipeline[]>("/crm/pipelines/")).data, staleTime: 60_000 });
}

export function useBoard(params: Record<string, unknown>) {
  return useQuery({
    queryKey: ["crm/leads", "board", params],
    queryFn: async () => (await api.get<Board>("/crm/leads/board/", { params: cleanParams(params) })).data,
  });
}

export function useFields() {
  return useQuery({ queryKey: ["crm/fields"], queryFn: async () => (await api.get<LeadField[]>("/crm/fields/")).data, staleTime: 60_000 });
}

export function useCrmSettings() {
  return useQuery({ queryKey: ["crm/settings"], queryFn: async () => (await api.get<CrmSettings>("/crm/settings/")).data, staleTime: 60_000 });
}

export function useDuplicateCheck(phone: string) {
  const digits = phone.replace(/\D+/g, "");
  return useQuery({
    queryKey: ["crm/leads", "duplicates", digits],
    queryFn: async () => (await api.get<Duplicate[]>("/crm/leads/duplicates/", { params: { phone: digits } })).data,
    enabled: digits.length >= 9,
  });
}

// ------------------------------------------------------------------ writes

function useLeadAction<T>(fn: (id: number, body: T) => Promise<Lead>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number } & T) => fn(id, body as T),
    onSuccess: (lead) => {
      qc.invalidateQueries({ queryKey: leadsApi.keys.all });
      qc.invalidateQueries({ queryKey: ["chatter"] });
      qc.setQueryData(leadsApi.keys.detail(lead.id), lead);
    },
  });
}

export const useMoveLead = () =>
  useLeadAction<{ stage_id: number; lost_reason?: string }>(async (id, b) => (await api.post<Lead>(`/crm/leads/${id}/move/`, b)).data);

export const useConvertLead = () =>
  useLeadAction<{ client_id?: number | null; project_name?: string }>(async (id, b) => (await api.post<Lead>(`/crm/leads/${id}/convert/`, b)).data);

/** `id` folds into `into_id` (the duplicates box: «Shu yerga birlashtirish»). */
export const useMergeLead = () =>
  useLeadAction<{ into_id: number }>(async (id, b) => (await api.post<Lead>(`/crm/leads/${id}/merge/`, b)).data);

export type BulkAction = "move" | "assign" | "tag" | "untag" | "lost" | "delete";
export function useBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: { ids: number[]; action: BulkAction; stage_id?: number; manager_id?: number | null; tag?: string; reason?: string }) =>
      (await api.post<{ updated: number }>("/crm/leads/bulk/", b)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: leadsApi.keys.all }),
  });
}

function useSimple<T, R>(fn: (b: T) => Promise<R>, keys: string[][]) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => keys.forEach((k) => qc.invalidateQueries({ queryKey: k })) });
}

const STRUCTURE = [["crm/pipelines"], ["crm/leads"]];

export const useSaveStage = () =>
  useSimple(async ({ id, ...data }: Partial<Stage> & { id?: number }) =>
    id ? (await api.patch<Stage>(`/crm/stages/${id}/`, data)).data : (await api.post<Stage>("/crm/stages/", data)).data, STRUCTURE);
export const useDeleteStage = () => useSimple(async (id: number) => api.delete(`/crm/stages/${id}/`), STRUCTURE);
export const useOrderStages = () =>
  useSimple(async ({ pipeline, ids }: { pipeline: number; ids: number[] }) => api.post(`/crm/pipelines/${pipeline}/order/`, { ids }), STRUCTURE);
export const useSavePipeline = () =>
  useSimple(async ({ id, ...data }: Partial<Pipeline> & { id?: number }) =>
    id ? (await api.patch<Pipeline>(`/crm/pipelines/${id}/`, data)).data : (await api.post<Pipeline>("/crm/pipelines/", data)).data, STRUCTURE);
export const useAddLostReason = () =>
  useSimple(async ({ pipeline, text }: { pipeline: number; text: string }) => api.post(`/crm/pipelines/${pipeline}/lost-reasons/`, { text }), STRUCTURE);
export const useDeleteLostReason = () => useSimple(async (id: number) => api.delete(`/crm/lost-reasons/${id}/`), STRUCTURE);

export const useSaveField = () =>
  useSimple(async ({ id, ...data }: Partial<LeadField> & { id?: number }) =>
    id ? (await api.patch<LeadField>(`/crm/fields/${id}/`, data)).data : (await api.post<LeadField>("/crm/fields/", data)).data,
  [["crm/fields"], ["crm/leads"]]);
export const useDeleteField = () => useSimple(async (id: number) => api.delete(`/crm/fields/${id}/`), [["crm/fields"]]);

export const useSaveCrmSettings = () =>
  useSimple(async (data: Partial<CrmSettings>) => (await api.patch<CrmSettings>("/crm/settings/", data)).data, [["crm/settings"]]);

// ------------------------------------------------------------------ display

/** A custom value as the card shows it. */
export function fieldText(f: LeadField, v: FieldValue | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  if (f.type === "bool") return v ? "✓" : "";
  if (f.type === "number") return new Intl.NumberFormat("ru-RU").format(Number(v)).replace(/,/g, " ");
  if (f.type === "date") return String(v).split("-").reverse().join(".");
  return String(v);
}

/** The tag's tone: the same word always gets the same colour. */
export function tagTone(tag: string): Tone {
  const tones: Tone[] = ["accent", "info", "done", "warn", "ok", "neutral"];
  let h = 0;
  for (const ch of tag) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return tones[h % tones.length];
}

/** 25 500 000 → "25,5 mln" (Uzbek short amounts on cards and column heads). */
export function compact(n: number): string {
  const f = (x: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(x);
  if (Math.abs(n) >= 1e9) return `${f(n / 1e9)} mlrd`;
  if (Math.abs(n) >= 1e6) return `${f(n / 1e6)} mln`;
  if (Math.abs(n) >= 1e3) return `${f(n / 1e3)} ming`;
  return f(n);
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { StatusMap } from "@/components/Status";
import type { Tone } from "@/components/ui";
import { api, cleanParams, type Ref } from "@/lib/api";
import { crudResource } from "@/lib/crud";

export type LeadStatus = "open" | "won" | "lost";
export type TaskKind = "call" | "meeting" | "measure" | "message" | "other";

export type Stage = {
  id: number; pipeline_id: number; name: string; hint: string; position: number; tone: Tone;
  is_won: boolean; is_lost: boolean;
};
export type Pipeline = { id: number; name: string; position: number; is_default: boolean; is_active: boolean; stages: Stage[] };

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
  next_task_kind: TaskKind | null;
  next_task_text: string | null;
  next_task_due: string | null;
  open_tasks: number;
  calls_count: number;
  overdue: boolean;
  created_at: string;
  updated_at: string;
};

export type Lead = LeadCard & {
  stage_id: number; client_id: number | null; manager_id: number | null; source_id: number | null;
  address: string; notes: string;
};

export type LeadInput = Partial<{
  title: string; contact_name: string; phone: string; client_id: number | null; manager_id: number | null;
  source_id: number | null; budget: string; region: string; address: string; notes: string; stage_id: number;
}>;

export type Task = {
  id: number; lead_id: number; lead: { id: number; code: string; name: string }; kind: TaskKind; text: string;
  due_at: string | null; assignee: { id: number; full_name: string } | null; assignee_id: number | null;
  done: boolean; done_at: string | null; created_at: string;
};

export type Board = { pipeline: { id: number; name: string }; stages: (Stage & { leads: LeadCard[] })[] };

export const leadsApi = crudResource<LeadCard, Lead, LeadInput>("crm/leads");
export const tasksApi = crudResource<Task, Task, Partial<Pick<Task, "kind" | "text" | "due_at" | "done" | "assignee_id" | "lead_id">>>("crm/tasks");

export const LEAD_STATUS: StatusMap<LeadStatus> = {
  open: { label: "Ochiq", tone: "accent" },
  won: { label: "Yutildi", tone: "ok" },
  lost: { label: "Rad etildi", tone: "bad" },
};

export const TASK_KIND: Record<TaskKind, string> = {
  call: "Qo'ng'iroq", meeting: "Uchrashuv", measure: "O'lchov", message: "Xabar", other: "Boshqa",
};

export const LOST_REASONS = ["Qimmat", "Boshqa joydan oldi", "Javob bermayapti", "Hozir kerak emas", "Noto'g'ri raqam"];

/** A stage tone as the dot / top edge of its column (tokens only). */
export const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-faint", accent: "bg-accent", info: "bg-info", warn: "bg-warn", done: "bg-done", ok: "bg-ok", bad: "bg-bad",
};

export function usePipelines() {
  return useQuery({ queryKey: ["crm/pipelines"], queryFn: async () => (await api.get<Pipeline[]>("/crm/pipelines/")).data, staleTime: 60_000 });
}

export function useBoard(params: Record<string, unknown>) {
  return useQuery({
    queryKey: ["crm/leads", "board", params],
    queryFn: async () => (await api.get<Board>("/crm/leads/board/", { params: cleanParams(params) })).data,
  });
}

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

export function useSaveStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Stage> & { id?: number }) =>
      id ? (await api.patch<Stage>(`/crm/stages/${id}/`, data)).data : (await api.post<Stage>("/crm/stages/", data)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm/pipelines"] }); qc.invalidateQueries({ queryKey: leadsApi.keys.all }); },
  });
}

export function useDeleteStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/crm/stages/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm/pipelines"] }); qc.invalidateQueries({ queryKey: leadsApi.keys.all }); },
  });
}

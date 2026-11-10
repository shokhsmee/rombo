import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Ref } from "@/lib/api";
import { crudResource } from "@/lib/crud";

import type { PhotoStage, RequestKind, RequestSource, RequestStatus } from "./labels";

// ---- masters (ustalar)

export type MasterListItem = {
  id: number;
  code: string | null;
  name: string;
  phone: string;
  region: string;
  skills: string;
  employee: Ref | null;
  employee_id: number | null;
  is_active: boolean;
  notes: string;
  /** Linked when the master shared their phone in the master bot. Read-only. */
  telegram: { username: string; name: string; blocked: boolean } | null;
  active_jobs: number;
  done_jobs: number;
  rating_avg: number | null;
  created_at: string;
  updated_at: string;
};
export type Master = MasterListItem;

export type MasterInput = Partial<{
  name: string; phone: string; region: string; skills: string; employee_id: number | null; is_active: boolean; notes: string;
}>;

export const mastersApi = crudResource<MasterListItem, Master, MasterInput>("maintenance/masters");

// ---- service requests (arizalar)

export type RequestListItem = {
  id: number;
  code: string | null;
  status: RequestStatus;
  source: RequestSource;
  kind: RequestKind;
  client: Ref;
  project: Ref | null;
  master: Ref | null;
  phone: string;
  address: string;
  preferred_date: string | null;
  scheduled_at: string | null;
  is_warranty: boolean;
  price: string;
  rating: number | null;
  created_at: string;
};

export type ServicePhoto = { id: number; stage: PhotoStage; url: string; created_at: string };

export type ServiceRequest = RequestListItem & {
  client_id: number;
  project_id: number | null;
  description: string;
  latitude: string | null;
  longitude: string | null;
  report: string;
  cancel_reason: string;
  feedback: string;
  /** `url` is a signed link, usable as <img src>. */
  photos: ServicePhoto[];
  allowed_statuses: RequestStatus[];
  client_telegram: boolean;
  assigned_at: string | null;
  started_at: string | null;
  done_at: string | null;
  closed_at: string | null;
  updated_at: string;
};

export type RequestInput = Partial<{
  client_id: number | null;
  project_id: number | null;
  kind: RequestKind;
  description: string;
  phone: string;
  address: string;
  latitude: string | null;
  longitude: string | null;
  preferred_date: string | null;
  is_warranty: boolean;
  price: string;
}>;

export const requestsApi = crudResource<RequestListItem, ServiceRequest, RequestInput>("maintenance/requests");

const MODEL = "maintenance.servicerequest";

/** After a workflow action: put the fresh detail in the cache, refresh lists, counters and history. */
function useRefresh() {
  const qc = useQueryClient();
  return (r: ServiceRequest) => {
    qc.setQueryData(requestsApi.keys.detail(r.id), r);
    qc.invalidateQueries({ queryKey: requestsApi.keys.all });
    qc.invalidateQueries({ queryKey: mastersApi.keys.all }); // active / done job counts
    qc.invalidateQueries({ queryKey: ["chatter", MODEL, r.id] });
  };
}

export function useAssign(id: number) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (body: { master_id: number; scheduled_at: string | null }) =>
      (await api.post<ServiceRequest>(`/maintenance/requests/${id}/assign/`, body)).data,
    onSuccess: refresh,
  });
}

export function useChangeStatus(id: number) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (body: { status: RequestStatus; comment?: string }) =>
      (await api.post<ServiceRequest>(`/maintenance/requests/${id}/status/`, { comment: "", ...body })).data,
    onSuccess: refresh,
  });
}

export function useRequestSummary() {
  return useQuery({
    queryKey: [...requestsApi.keys.all, "summary"],
    queryFn: async () => (await api.get<{ status: RequestStatus; count: number }[]>("/maintenance/requests/summary/")).data,
  });
}

type BotInfo = { enabled: boolean; webapp: string; webapp_https: boolean; users: number };

export function useBots() {
  return useQuery({
    queryKey: ["maintenance", "bots"],
    queryFn: async () => (await api.get<{ client: BotInfo; master: BotInfo }>("/maintenance/requests/bots/")).data,
    staleTime: 5 * 60_000,
  });
}

export function useRequestPhotos(id: number) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: requestsApi.keys.detail(id) });
    qc.invalidateQueries({ queryKey: ["chatter", MODEL, id] });
  };
  const upload = useMutation({
    mutationFn: async ({ file, stage }: { file: File; stage: PhotoStage }) => {
      const body = new FormData();
      body.append("file", file);
      body.append("stage", stage);
      return (await api.post<ServicePhoto>(`/maintenance/requests/${id}/photos/`, body)).data;
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (photoId: number) => api.delete(`/maintenance/requests/${id}/photos/${photoId}/`),
    onSuccess: refresh,
  });
  return { upload, remove };
}

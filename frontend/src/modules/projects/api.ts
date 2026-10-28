import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { crudResource } from "@/lib/crud";
import { api, type Ref } from "@/lib/api";

export type ProjectStatus =
  | "draft" | "confirmed" | "procurement" | "production" | "ready" | "delivered" | "closed" | "cancelled";
export type Currency = "UZS" | "USD";

export type ProjectListItem = {
  id: number;
  code: string;
  name: string;
  status: ProjectStatus;
  client: Ref;
  manager: Ref | null;
  region: string;
  deadline: string | null;
  amount: string;
  currency: Currency;
  created_at: string;
};

export type StatusLog = {
  id: number;
  from_status: string;
  to_status: ProjectStatus;
  comment: string;
  created_at: string;
  user: { id: number; full_name: string } | null;
};

export type Project = ProjectListItem & {
  client_id: number;
  manager_id: number | null;
  object_address: string;
  contract_number: string;
  contract_date: string | null;
  notes: string;
  allowed_statuses: ProjectStatus[];
  history: StatusLog[];
  updated_at: string;
};

export type ProjectInput = Partial<{
  name: string;
  client_id: number | null;
  manager_id: number | null;
  object_address: string;
  region: string;
  contract_number: string;
  contract_date: string | null;
  deadline: string | null;
  amount: string;
  currency: Currency;
  notes: string;
}>;

export const projectsApi = crudResource<ProjectListItem, Project, ProjectInput>("projects");

export function useChangeStatus(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { status: ProjectStatus; comment?: string }) =>
      (await api.post<Project>(`/projects/${id}/status/`, body)).data,
    onSuccess: (p) => {
      qc.setQueryData(projectsApi.keys.detail(p.id), p);
      qc.invalidateQueries({ queryKey: projectsApi.keys.all });
    },
  });
}

export function useProjectSummary() {
  return useQuery({
    queryKey: ["projects", "summary"],
    queryFn: async () => (await api.get<{ status: ProjectStatus; count: number }[]>("/projects/summary/")).data,
  });
}

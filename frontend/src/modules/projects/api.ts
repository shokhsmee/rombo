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
  sale_date: string | null;
  deadline: string | null;
  amount: string;
  debt_amount: string;
  total_area: string;
  currency: Currency;
  created_at: string;
};

export type RefShort = { id: number; name: string };

export type ProjectItem = { id?: number; product_type: RefShort; product_type_id: number; area_m2: string; quantity: number };

export type ProjectFile = { id: number; name: string; size: number; created_at: string; uploaded_by: string };

export type Project = ProjectListItem & {
  client_id: number;
  client_phone: string;
  client_segment: RefShort | null;
  manager_id: number | null;
  partner: Ref | null;
  partner_id: number | null;
  sales_channel: RefShort | null;
  sales_channel_id: number | null;
  brand: RefShort | null;
  brand_id: number | null;
  product_name: string;
  phone: string;
  location: string;
  service_amount: string;
  advance_amount: string;
  total_amount: string;
  mosquito_net: boolean;
  dismantling: boolean;
  items: ProjectItem[];
  total_quantity: number;
  files: ProjectFile[];
  object_address: string;
  contract_number: string;
  contract_date: string | null;
  notes: string;
  allowed_statuses: ProjectStatus[];
  updated_at: string;
};

export type ProjectInput = Partial<{
  partner_id: number | null;
  sales_channel_id: number | null;
  brand_id: number | null;
  product_name: string;
  phone: string;
  location: string;
  sale_date: string | null;
  service_amount: string;
  advance_amount: string;
  mosquito_net: boolean;
  dismantling: boolean;
  items: { product_type_id: number; area_m2: string; quantity: number }[];
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
      qc.invalidateQueries({ queryKey: ["chatter", "projects.project", p.id] });
    },
  });
}

export function useProjectSummary() {
  return useQuery({
    queryKey: ["projects", "summary"],
    queryFn: async () => (await api.get<{ status: ProjectStatus; count: number }[]>("/projects/summary/")).data,
  });
}

// ---- drawings

export function useProjectFiles(projectId: number) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: projectsApi.keys.detail(projectId) });
    qc.invalidateQueries({ queryKey: ["chatter", "projects.project", projectId] });
  };
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return (await api.post<ProjectFile>(`/projects/${projectId}/files/`, body)).data;
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (fileId: number) => api.delete(`/projects/${projectId}/files/${fileId}/`),
    onSuccess: refresh,
  });
  return { upload, remove };
}

/** Files are behind auth, so download through axios and hand the browser a blob. */
export async function downloadProjectFile(projectId: number, f: ProjectFile) {
  const { data } = await api.get<Blob>(`/projects/${projectId}/files/${f.id}/`, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = f.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

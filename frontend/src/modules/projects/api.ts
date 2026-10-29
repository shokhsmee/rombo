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
  calcs: CalcSummary[];
  usd_rate: string | null;
  advance_date: string | null;
  profile_color: string;
  door_accessory: string;
  window_accessory: string;
  windowsill: string;
  glass: string;
  shotlandka: string;
  client_address: string;
  client_passport: string;
  object_address: string;
  contract_number: string;
  contract_date: string | null;
  notes: string;
  allowed_statuses: ProjectStatus[];
  money: { invoiced: string; paid: string; debt: string };
  updated_at: string;
};

export type CalcSummary = { id: number; title: string; currency: Currency; calc_date: string; total: string };
export type CalcLine = { id: number; item_id: number | null; name: string; unit: string; price: string; qty: string; line_sum: string };
export type Calc = CalcSummary & { price_list_id: number | null; bar_length_m: string | null; notes: string; lines: CalcLine[]; updated_at: string };

export type ProjectInput = Partial<{
  usd_rate: string | null;
  advance_date: string | null;
  profile_color: string;
  door_accessory: string;
  window_accessory: string;
  windowsill: string;
  glass: string;
  shotlandka: string;
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

// ---- hisob-kitob

const calcKey = (projectId: number, calcId?: number) => ["projects", "calc", projectId, calcId ?? "all"];

export function useCalc(projectId: number, calcId: number) {
  return useQuery({
    queryKey: calcKey(projectId, calcId),
    queryFn: async () => (await api.get<Calc>(`/projects/${projectId}/calcs/${calcId}/`)).data,
  });
}

/** Create / save / refresh / delete a calculation; every change refreshes the card (its amount) and history. */
export function useCalcActions(projectId: number) {
  const qc = useQueryClient();
  const done = (c?: Calc) => {
    if (c) qc.setQueryData(calcKey(projectId, c.id), c);
    qc.invalidateQueries({ queryKey: projectsApi.keys.all });
    qc.invalidateQueries({ queryKey: ["chatter", "projects.project", projectId] });
  };
  return {
    create: useMutation({
      mutationFn: async (priceListId: number) =>
        (await api.post<Calc>(`/projects/${projectId}/calcs/`, { price_list_id: priceListId })).data,
      onSuccess: done,
    }),
    save: useMutation({
      mutationFn: async ({ id, ...body }: { id: number; lines?: { id: number; qty: string; price: string }[]; notes?: string; calc_date?: string }) =>
        (await api.patch<Calc>(`/projects/${projectId}/calcs/${id}/`, body)).data,
      onSuccess: done,
    }),
    refresh: useMutation({
      mutationFn: async (id: number) => (await api.post<Calc>(`/projects/${projectId}/calcs/${id}/refresh-prices/`)).data,
      onSuccess: done,
    }),
    remove: useMutation({
      mutationFn: async (id: number) => api.delete(`/projects/${projectId}/calcs/${id}/`),
      onSuccess: () => done(),
    }),
  };
}

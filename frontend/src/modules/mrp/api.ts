import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, cleanParams } from "@/lib/api";
import { crudResource } from "@/lib/crud";
import type { Category, ProductRef } from "@/modules/inventory/api";

export type Basis = "dona" | "m2";

// ---- BOM (Tarkib)

export type BomLine = { id?: number; component: ProductRef; component_id: number; qty: string; basis: Basis; waste_pct: string; note: string };
export type BomListItem = { id: number; code: string; product: ProductRef; name: string; version: number; is_active: boolean; lines_count: number; updated_at: string };
export type Bom = BomListItem & {
  product_id: number; lines: BomLine[]; notes: string; previous_code: string | null; in_use: boolean; created_at: string;
  cost: { per_piece: string; per_m2: string; lines: { line_id: number; unit_cost: string; cost: string }[] };
};
export type BomInput = Partial<{
  product_id: number | null; name: string; notes: string; is_active: boolean;
  lines: { component_id: number; qty: string; basis: Basis; waste_pct: string; note: string }[];
}>;

export const bomsApi = crudResource<BomListItem, Bom, BomInput>("mrp/boms");

/** The product's active BOM (product card, Loyiha items). */
export function useActiveBom(productId: number | null | undefined) {
  return useQuery({
    queryKey: [bomsApi.keys.all[0], "active", productId],
    queryFn: async () => (await api.get<{ items: BomListItem[] }>("/mrp/boms/", { params: { product: productId, is_active: true } })).data.items[0] ?? null,
    enabled: !!productId,
  });
}

export function useExplode(bomId: number | undefined, count: string, area: string) {
  return useQuery({
    queryKey: ["mrp", "explode", bomId, count, area],
    queryFn: async () => (await api.get<{ product: ProductRef; qty: string }[]>(`/mrp/boms/${bomId}/explode/`, { params: { count, area } })).data,
    enabled: !!bomId && Number(count) > 0,
    placeholderData: keepPreviousData,
  });
}

// ---- Loyiha materials

export type MaterialRow = {
  product: ProductRef & { category: Category }; need: string; issued: string; remaining: string; requested: string;
  stock: string; unit_cost: string; planned_cost: string;
};
export type Materials = {
  frozen: boolean; issued_any: boolean; planned_cost: string; wip: string | null; rows: MaterialRow[];
  items: { position: number; item_id: number; product_type: string; area_m2: string; quantity: number;
    product: { id: number; code: string | null; name: string } | null; has_bom: boolean }[];
  fill?: { filled: number; missing: { id: number; code: string | null; name: string }[] };
  request?: { id: number; code: string };
  moves?: number[];
};

const matKey = (id: number) => ["mrp", "materials", id];

export function useMaterials(projectId: number, enabled = true) {
  return useQuery({
    queryKey: matKey(projectId),
    queryFn: async () => (await api.get<Materials>(`/mrp/projects/${projectId}/materials/`)).data,
    enabled,
  });
}

function useMaterialAction<B>(projectId: number, path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: B) => (await api.post<Materials>(`/mrp/projects/${projectId}/${path}/`, body)).data,
    onSuccess: (m: Materials) => {
      qc.setQueryData(matKey(projectId), m);
      qc.invalidateQueries();  // calcs, requests, moves, chatter all may have changed
    },
  });
}

export function useMaterialActions(projectId: number) {
  return {
    itemProduct: useMaterialAction<{ position: number; product_id: number | null }>(projectId, "item-product"),
    freeze: useMaterialAction<Record<string, never>>(projectId, "freeze"),
    fillCalc: useMaterialAction<{ calc_id: number }>(projectId, "fill-calc"),
    toRequest: useMaterialAction<Record<string, never>>(projectId, "to-request"),
    toIssue: useMaterialAction<{ warehouse_id?: number | null }>(projectId, "to-issue"),
  };
}

// ---- MRP plan

export type PlanRow = {
  product: ProductRef & { category: Category; order_multiple: string | null };
  need: string; stock: string; on_order: string; requested: string; shortage: string; to_buy: string;
  projects: { project: { id: number; code: string; name: string; client: string; deadline: string | null }; need: string; covered: string; short: string }[];
};
export type Plan = { rows: PlanRow[]; short: number; projects: number };

export function usePlan(params: Record<string, unknown>) {
  return useQuery({
    queryKey: ["mrp", "plan", params],
    queryFn: async () => (await api.get<Plan>("/mrp/plan/", { params: cleanParams(params) })).data,
    placeholderData: keepPreviousData,
  });
}

export function usePlanToRequests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (product_ids: number[]) =>
      (await api.post<{ requests: { id: number; code: string; project: string }[] }>("/mrp/plan/to-requests/", { product_ids })).data,
    onSuccess: () => qc.invalidateQueries(),
  });
}

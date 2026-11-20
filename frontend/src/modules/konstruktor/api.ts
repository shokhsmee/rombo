import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { crudResource } from "@/lib/crud";
import type { RefShort } from "@/modules/projects/api";

import type { Design } from "./design";

export type RoleUnit = "bars" | "m" | "m2" | "pcs";
export type RoleChoice = { value: string; label: string; unit: RoleUnit };

export type SystemItem = {
  id?: number; role: string; price_list_item: number; factor: string; round_up: boolean;
  name?: string; unit?: string; price?: string; role_unit?: RoleUnit;
};

export type SystemListItem = {
  id: number; name: string; price_list: { id: number; name: string; currency: "USD" | "UZS" };
  product_type: RefShort | null; bar_length_mm: string; is_active: boolean; needs_check: boolean; constructions_count: number;
};

export const PARAMS = [
  "frame_width", "mullion_width", "sash_width", "weld_allowance", "mullion_allowance", "sash_overlap",
  "glass_deduction_fixed", "glass_deduction_sash", "bead_allowance",
] as const;
export type ParamKey = (typeof PARAMS)[number];

export type ProfileSystem = SystemListItem & Record<ParamKey, string> & {
  price_list_id: number; product_type_id: number | null; kerf_mm: string; trim_mm: string; junk_pct: string;
  default_glass_id: number | null; notes: string; items: SystemItem[]; updated_at: string;
};

export const systemsApi = crudResource<SystemListItem, ProfileSystem, Record<string, unknown>>("konstruktor/systems");

export function useRoles() {
  return useQuery({
    queryKey: ["konstruktor", "roles"],
    queryFn: async () => (await api.get<RoleChoice[]>("/konstruktor/systems/roles/")).data,
    staleTime: Infinity,
  });
}

// ------------------------------------------------------------------ engine output

export type EnginePiece = { role: string; length: number; label: string };
export type EngineCell = {
  n: number; path: string; x: number; y: number; w: number; h: number; opening: [number, number];
  fill: string; sash: { type: string; hinge: string } | null; glass?: [number, number]; sash_size?: [number, number];
};
export type EngineResult = {
  w: number; h: number; area_m2: number; pieces: EnginePiece[];
  glass: { cell: number; item: number | null; w: number; h: number; m2: number }[];
  fills: { cell: number; fill: string; w: number; h: number; m2: number }[];
  cells: EngineCell[]; counts: Record<string, number>; lengths_m: Record<string, number>;
};

export type PriceLine = {
  item_id: number; name: string; unit: string; price: string; qty: string; sum: string;
  price_list_id: number; from: string[]; bars: boolean;
};
export type CutPlan = {
  item: string; count: number; bar_length: number; total_length: number; waste_pct: number;
  bars: { pieces: EnginePiece[]; used: number; offcut: number }[];
};
export type Priced = {
  lines: PriceLine[]; cut: Record<string, CutPlan>; unmapped: { label: string; qty: string; unit: string }[];
  totals: Record<string, string>; area_m2: string; count: number;
};
export type Preview = Priced & { result: EngineResult };

// ------------------------------------------------------------------ constructions

export type Construction = {
  id: number; code: string; project_id: number; system_id: number; system: { id: number; name: string; price_list_id: number };
  product_type_id: number | null; product_type: RefShort | null; name: string; sort_order: number; count: number;
  design: Design; result: EngineResult; area_m2: string; size_label: string; notes: string; updated_at: string;
};

export type ConstructionInput = Partial<Pick<Construction, "project_id" | "system_id" | "product_type_id" | "name" | "count" | "design" | "notes" | "sort_order">>;

const cons = crudResource<Construction, Construction, ConstructionInput>("konstruktor/constructions");

export const constructionsApi = {
  ...cons,
  useOfProject(projectId: number | undefined) {
    return useQuery({
      queryKey: ["konstruktor/constructions", "project", projectId],
      queryFn: async () => (await api.get<{ items: Construction[] }>("/konstruktor/constructions/", { params: { project: projectId, size: 100 } })).data.items,
      enabled: !!projectId,
    });
  },
};

export function usePreview() {
  return useMutation({
    mutationFn: async (body: { system_id: number; design: Design; count: number }) =>
      (await api.post<Preview>("/konstruktor/constructions/preview/", body)).data,
  });
}

export function useProjectSummary(projectId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ["konstruktor/constructions", "summary", projectId],
    queryFn: async () => (await api.get<Priced>(`/konstruktor/projects/${projectId}/summary/`)).data,
    enabled: !!projectId && enabled,
  });
}

/** After any construction write the Loyiha (items, amount, chatter) and its calcs changed too. */
export function useInvalidateProject() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["konstruktor/constructions"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["chatter"] });
  };
}

export function useFillCalc(projectId: number) {
  const invalidate = useInvalidateProject();
  return useMutation({
    mutationFn: async () => (await api.post<{ calcs: { id: number; title: string; total: string }[] }>(`/konstruktor/projects/${projectId}/fill-calc/`)).data,
    onSuccess: invalidate,
  });
}

export function useDuplicate() {
  const invalidate = useInvalidateProject();
  return useMutation({
    mutationFn: async (id: number) => (await api.post<Construction>(`/konstruktor/constructions/${id}/duplicate/`)).data,
    onSuccess: invalidate,
  });
}

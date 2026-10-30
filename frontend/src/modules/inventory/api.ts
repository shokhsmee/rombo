import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, cleanParams, type Ref } from "@/lib/api";
import { crudResource } from "@/lib/crud";

export type Category = "profil" | "oyna" | "furnitura" | "material" | "yarim" | "tayyor";
export type MoveType = "receipt" | "issue" | "output" | "delivery" | "transfer" | "adjust";
export type MoveStatus = "draft" | "posted" | "cancelled";

// ---- warehouses

export type Warehouse = {
  id: number; name: string; address: string; responsible: Ref | null; responsible_id: number | null;
  is_default: boolean; is_active: boolean; has_moves: boolean; updated_at: string;
};
export type WarehouseInput = Partial<{ name: string; address: string; responsible_id: number | null; is_default: boolean; is_active: boolean }>;
export type WarehouseRef = { id: number; name: string };

export function useWarehouses(enabled = true) {
  return useQuery({
    queryKey: ["inventory", "warehouses"],
    queryFn: async () => (await api.get<Warehouse[]>("/inventory/warehouses/")).data,
    staleTime: 60_000,
    enabled,
  });
}

export function useWarehouseActions() {
  const qc = useQueryClient();
  const done = () => { qc.invalidateQueries({ queryKey: ["inventory", "warehouses"] }); qc.invalidateQueries({ queryKey: ["chatter"] }); };
  return {
    save: useMutation({
      mutationFn: async ({ id, data }: { id?: number; data: WarehouseInput }) =>
        id ? (await api.patch<Warehouse>(`/inventory/warehouses/${id}/`, data)).data
          : (await api.post<Warehouse>("/inventory/warehouses/", data)).data,
      onSuccess: done,
    }),
    remove: useMutation({ mutationFn: async (id: number) => api.delete(`/inventory/warehouses/${id}/`), onSuccess: done }),
  };
}

// ---- products

export type ProductRef = { id: number; code: string | null; name: string; sku: string; unit: string; category: Category };
export type Product = ProductRef & {
  default_cost: string; order_multiple: string | null; price_item_id: number | null; price_item: { id: number; name: string; price_list: number } | null;
  is_active: boolean; notes: string; qty_on_hand: string; value_on_hand: string; avg_cost: string | null;
  created_at: string; updated_at: string;
};
export type ProductInput = Partial<{
  name: string; sku: string; unit: string; category: Category; default_cost: string; order_multiple: string | null; price_item_id: number | null;
  is_active: boolean; notes: string;
}>;

export const productsApi = crudResource<Product, Product, ProductInput>("inventory/products");

// ---- moves

export type StockMoveListItem = {
  id: number; code: string | null; type: MoveType; status: MoveStatus; date: string; product: ProductRef;
  warehouse: WarehouseRef; to_warehouse: WarehouseRef | null; qty: string; unit_cost: string | null; amount: string;
  project: Ref | null; partner: Ref | null; source_model: string; source_id: number | null; source_label: string;
  entry_code: string | null; entry_id: number | null; notes: string; created_at: string;
};
export type StockMove = StockMoveListItem & {
  product_id: number; warehouse_id: number; to_warehouse_id: number | null; project_id: number | null;
  partner_id: number | null; on_hand: { qty: string; avg_cost: string | null } | null;
  posted_at: string | null; posted_by: string; created_by: string; allowed_statuses: MoveStatus[]; updated_at: string;
};
export type StockMoveInput = Partial<{
  type: MoveType; date: string; product_id: number | null; warehouse_id: number | null; to_warehouse_id: number | null;
  qty: string; unit_cost: string | null; project_id: number | null; partner_id: number | null; notes: string;
}>;

export const movesApi = crudResource<StockMoveListItem, StockMove, StockMoveInput>("inventory/moves");

export function useMoveActions(id: number) {
  const qc = useQueryClient();
  const done = (m: StockMove) => {
    qc.setQueryData(movesApi.keys.detail(m.id), m);
    qc.invalidateQueries({ queryKey: movesApi.keys.all });
    qc.invalidateQueries({ queryKey: ["inventory"] });
    qc.invalidateQueries({ queryKey: productsApi.keys.all });
    qc.invalidateQueries({ queryKey: ["accounting"] });
    qc.invalidateQueries({ queryKey: ["chatter"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  };
  return {
    post: useMutation({ mutationFn: async () => (await api.post<StockMove>(`/inventory/moves/${id}/post/`, {})).data, onSuccess: done }),
    cancel: useMutation({
      mutationFn: async (body: { comment: string }) => (await api.post<StockMove>(`/inventory/moves/${id}/cancel/`, body)).data,
      onSuccess: done,
    }),
  };
}

export type MovesSummary = { count: number; kirim: string; chiqim: string; yetkazish: string; stock_value: string };

export function useMovesSummary(query: Record<string, unknown>) {
  const { page: _p, size: _s, sort: _o, ...filters } = query;
  return useQuery({
    queryKey: ["inventory", "summary", filters],
    queryFn: async () => (await api.get<MovesSummary>("/inventory/moves/summary/", { params: cleanParams(filters), paramsSerializer: { indexes: null } })).data,
    placeholderData: keepPreviousData,
  });
}

// ---- stock on hand

export type StockRow = { product: ProductRef; warehouse: WarehouseRef; qty: string; value: string; avg_cost: string | null };
export type Stock = { rows: StockRow[]; total_value: string; products: number };

export function useStock(params: { warehouse?: string; category?: string; q?: string; nonzero?: boolean }) {
  return useQuery({
    queryKey: ["inventory", "stock", params],
    queryFn: async () => (await api.get<Stock>("/inventory/stock/", { params: cleanParams(params) })).data,
    placeholderData: keepPreviousData,
  });
}

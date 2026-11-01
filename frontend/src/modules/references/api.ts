import { useQuery } from "@tanstack/react-query";

import { api, type Page } from "@/lib/api";
import { crudResource } from "@/lib/crud";

export type RefKind = "sales_channel" | "product_type" | "brand" | "client_segment";

export const REF_KINDS: { kind: RefKind; label: string; hint: string }[] = [
  { kind: "product_type", label: "Buyurtma turi", hint: "Termo, PVX, Novation… — har biri loyihada o'z kvadraturasi bilan" },
  { kind: "sales_channel", label: "Sotuv kanali", hint: "Buyurtma qayerdan keldi" },
  { kind: "brand", label: "Brend", hint: "Profil brendi" },
  { kind: "client_segment", label: "Mijoz segmenti", hint: "Mijoz kartochkasida tanlanadi" },
];

export type RefItem = { id: number; kind: RefKind; name: string; sort_order: number; is_active: boolean };

export const refsApi = crudResource<RefItem, RefItem, Partial<RefItem>>("references");

/** All items of one list (cached; lists are short and change rarely). */
export function useRefs(kind: RefKind) {
  return useQuery({
    queryKey: ["references", "list", { kind, size: 200, sort: "sort_order" }],
    queryFn: async () => (await api.get<Page<RefItem>>("/references/", { params: { kind, size: 200, sort: "sort_order" } })).data.items,
    staleTime: 5 * 60_000,
  });
}

// ---- units of measure (add-units-of-measure)

export type UomCategory = "count" | "length" | "area" | "weight" | "volume" | "other";

export const UOM_CATEGORY: Record<UomCategory, { label: string; base: string }> = {
  count: { label: "Dona", base: "dona" },
  length: { label: "Uzunlik", base: "m" },
  area: { label: "Yuza", base: "m2" },
  weight: { label: "Og'irlik", base: "kg" },
  volume: { label: "Hajm", base: "l" },
  other: { label: "Boshqa (o'girilmaydi)", base: "" },
};

export type Uom = {
  id: number; name: string; category: UomCategory; category_label: string; ratio: string; aliases: string;
  sort_order: number; is_active: boolean;
};

export const uomsApi = crudResource<Uom, Uom, Partial<Uom>>("references/uoms");

/** All units (one short list, cached): product pickers and the settings tab. */
export function useUoms() {
  return useQuery({
    queryKey: ["references", "uoms"],
    queryFn: async () => (await api.get<Uom[]>("/references/uoms/")).data,
    staleTime: 5 * 60_000,
  });
}

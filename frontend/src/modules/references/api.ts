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

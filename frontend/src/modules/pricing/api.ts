import { crudResource } from "@/lib/crud";
import type { RefShort } from "@/modules/projects/api";

export type PriceItem = { id?: number; name: string; unit: string; price: string; is_active: boolean };

export type PriceListItem = {
  id: number;
  name: string;
  product_type: RefShort | null;
  bar_length_m: string | null;
  currency: "UZS" | "USD";
  is_active: boolean;
  items_count: number;
};

export type PriceList = PriceListItem & { product_type_id: number | null; notes: string; items: PriceItem[]; updated_at: string };

export type PriceListInput = Partial<Omit<PriceList, "id" | "product_type" | "items_count" | "updated_at">>;

export const pricingApi = crudResource<PriceListItem, PriceList, PriceListInput>("pricing");

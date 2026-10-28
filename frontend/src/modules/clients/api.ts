import type { Ref } from "@/lib/api";
import { crudResource } from "@/lib/crud";

export type ClientKind = "individual" | "company" | "dealer";

export const KIND_LABEL: Record<ClientKind, string> = {
  individual: "Jismoniy shaxs",
  company: "Yuridik shaxs",
  dealer: "Diler",
};

export type ClientListItem = {
  id: number;
  code: string;
  kind: ClientKind;
  name: string;
  tin: string;
  contact_person: string;
  phone: string;
  region: string;
  is_active: boolean;
  manager: Ref | null;
};

export type Client = ClientListItem & {
  phone_extra: string;
  email: string;
  address: string;
  source: string;
  notes: string;
  manager_id: number | null;
  projects_count: number;
  created_at: string;
  updated_at: string;
};

export type ClientInput = Partial<Omit<Client, "id" | "code" | "manager" | "projects_count" | "created_at" | "updated_at">>;

export const clientsApi = crudResource<ClientListItem, Client, ClientInput>("clients");

export const REGIONS = [
  "Toshkent sh.", "Toshkent vil.", "Andijon", "Buxoro", "Farg'ona", "Jizzax", "Xorazm", "Namangan",
  "Navoiy", "Qashqadaryo", "Qoraqalpog'iston", "Samarqand", "Sirdaryo", "Surxondaryo",
];

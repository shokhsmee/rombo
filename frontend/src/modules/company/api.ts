import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type Company = {
  name: string;
  legal_form: string;
  director: string;
  director_short: string;
  city: string;
  address: string;
  bank_account: string;
  bank_name: string;
  mfo: string;
  inn: string;
  phone: string;
  delivery_days: number;
  prepay_percent: number;
  vat_payer: boolean;
  vat_code: string;
  vat_rate: string;
  lock_date: string | null;
  updated_at: string;
};

export function useCompany() {
  return useQuery({ queryKey: ["company"], queryFn: async () => (await api.get<Company>("/company/")).data, staleTime: 5 * 60_000 });
}

export function useSaveCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Company>) => (await api.patch<Company>("/company/", data)).data,
    onSuccess: (c) => qc.setQueryData(["company"], c),
  });
}

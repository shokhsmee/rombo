import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type DashKpi = { key: string; label: string; value: string | number; unit: string; link: string | null; hint: string; tone: string };
export type DashSection = {
  key: "sales" | "crm" | "procurement" | "finance" | "accounting" | "inventory" | "hr";
  title: string;
  link: string;
  kpis: DashKpi[];
  series: Record<string, Record<string, string | number>[]>;
  lists: Record<string, Record<string, string | number | null>[]>;
};
export type Dashboard = { months: string[]; today: string; sections: DashSection[] };

export function useDashboard(enabled = true) {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<Dashboard>("/dashboard/")).data,
    staleTime: 60_000,
    enabled,
  });
}

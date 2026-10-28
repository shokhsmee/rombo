import { useQuery } from "@tanstack/react-query";

import type { StatusMap } from "@/components/Status";
import { api } from "@/lib/api";
import { crudResource } from "@/lib/crud";

export type EmployeeStatus = "active" | "on_leave" | "dismissed";

export const EMP_STATUS: StatusMap<EmployeeStatus> = {
  active: { label: "Ishlamoqda", tone: "ok" },
  on_leave: { label: "Ta'tilda", tone: "warn" },
  dismissed: { label: "Bo'shagan", tone: "neutral" },
};

export type EmployeeListItem = {
  id: number;
  code: string;
  name: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  phone: string;
  department: string;
  position: string;
  status: EmployeeStatus;
  hire_date: string | null;
  user: { id: number; username: string } | null;
};

export type Employee = EmployeeListItem & {
  email: string;
  birth_date: string | null;
  address: string;
  notes: string;
  user_id: number | null;
  created_at: string;
  updated_at: string;
};

export const employeesApi = crudResource<EmployeeListItem, Employee, Record<string, unknown>>("employees");

export function useDepartments() {
  return useQuery({
    queryKey: ["employees", "departments"],
    queryFn: async () => (await api.get<string[]>("/employees/departments/")).data,
    staleTime: 5 * 60_000,
  });
}

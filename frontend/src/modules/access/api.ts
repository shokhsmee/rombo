import { useQueries, useQuery } from "@tanstack/react-query";

import type { PageKey, PermAction } from "@/auth/AuthProvider";
import { api } from "@/lib/api";
import { crudResource } from "@/lib/crud";

export type PageDef = { key: PageKey; label: string; group: string; actions: PermAction[]; planned: boolean };

export type Permission = {
  page_key: PageKey;
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
};

export type RoleListItem = { id: number; name: string; description: string; is_system: boolean; users_count: number };
export type Role = RoleListItem & { permissions: Permission[]; created_at: string; updated_at: string };
export type RoleInput = { name?: string; description?: string; permissions?: Permission[] };

export const rolesApi = crudResource<RoleListItem, Role, RoleInput>("access/roles");

export const ACTIONS: { key: PermAction; label: string }[] = [
  { key: "view", label: "Ko'rish" },
  { key: "create", label: "Yaratish" },
  { key: "update", label: "Tahrirlash" },
  { key: "delete", label: "O'chirish" },
];

export function usePages() {
  return useQuery({
    queryKey: ["access", "pages"],
    queryFn: async () => (await api.get<PageDef[]>("/access/pages/")).data,
    staleTime: Infinity,
  });
}

/** Group pages in registry order: [["Savdo", [...]], ...] */
export function groupPages(pages: PageDef[]) {
  const groups = new Map<string, PageDef[]>();
  for (const p of pages) groups.set(p.group, [...(groups.get(p.group) ?? []), p]);
  return [...groups.entries()];
}

/** Union of several roles' matrices — mirrors backend effective_permissions(). */
export function useRolesUnion(roleIds: number[]) {
  const results = useQueries({
    queries: roleIds.map((id) => ({
      queryKey: rolesApi.keys.detail(id),
      queryFn: async () => (await api.get<Role>(`/access/roles/${id}/`)).data,
    })),
  });
  const map: Partial<Record<PageKey, Set<PermAction>>> = {};
  for (const r of results) {
    for (const p of r.data?.permissions ?? []) {
      const set = (map[p.page_key] ??= new Set());
      ACTIONS.forEach((a) => p[`can_${a.key}`] && set.add(a.key));
    }
  }
  return { map, loading: results.some((r) => r.isLoading) };
}

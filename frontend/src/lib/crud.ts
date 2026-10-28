import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, cleanParams, type Page } from "@/lib/api";

/**
 * Standard data hooks for a REST resource at /api/v1/<resource>/.
 * Every module's api.ts is a one-liner: `export const clientsApi = crudResource<ClientList, Client>("clients")`.
 */
export function crudResource<TList, TDetail, TInput = Partial<TDetail>>(path: string) {
  const base = `/${path}/`;
  const keys = {
    all: [path] as const,
    list: (q: object) => [path, "list", q] as const,
    detail: (id: number | string) => [path, "detail", String(id)] as const,
  };

  return {
    keys,

    useList(query: Record<string, unknown>, opts: { enabled?: boolean } = {}) {
      return useQuery({
        queryKey: keys.list(query),
        queryFn: async () =>
          (await api.get<Page<TList>>(base, { params: cleanParams(query), paramsSerializer: { indexes: null } })).data,
        placeholderData: keepPreviousData,
        enabled: opts.enabled ?? true,
      });
    },

    useDetail(id: number | string | undefined) {
      return useQuery({
        queryKey: keys.detail(id ?? "new"),
        queryFn: async () => (await api.get<TDetail>(`${base}${id}/`)).data,
        enabled: !!id && id !== "new",
      });
    },

    useSave() {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: async ({ id, data }: { id?: number | string; data: TInput }) =>
          id && id !== "new"
            ? (await api.patch<TDetail>(`${base}${id}/`, data)).data
            : (await api.post<TDetail>(base, data)).data,
        onSuccess: (saved) => {
          qc.invalidateQueries({ queryKey: keys.all });
          const id = (saved as { id?: number }).id;
          if (id) qc.setQueryData(keys.detail(id), saved);
        },
      });
    },

    useRemove() {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: async (id: number | string) => api.delete(`${base}${id}/`),
        onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
      });
    },
  };
}

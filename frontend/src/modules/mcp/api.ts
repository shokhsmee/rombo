import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Page } from "@/lib/api";

export type TokenScope = "read" | "write";

export type McpToken = {
  id: number;
  name: string;
  /** First 8 characters of the secret, to tell tokens apart. */
  prefix: string;
  scope: TokenScope;
  expires_at: string | null;
  is_expired: boolean;
  last_used_at: string | null;
  created_at: string;
};

/** Returned once, right after creation. */
export type IssuedToken = McpToken & { token: string; endpoint: string; connector_url: string };

const KEY = ["mcp", "tokens"] as const;

export function useTokens() {
  return useQuery({ queryKey: KEY, queryFn: async () => (await api.get<Page<McpToken>>("/mcp/tokens/", { params: { size: 100 } })).data });
}

export function useMcpInfo() {
  return useQuery({
    queryKey: ["mcp", "info"],
    queryFn: async () => (await api.get<{ endpoint: string; server_name: string }>("/mcp/tokens/info/")).data,
    staleTime: Infinity,
  });
}

export function useIssueToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; scope: TokenScope; expires_days: number | null }) =>
      (await api.post<IssuedToken>("/mcp/tokens/", body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRevokeToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/mcp/tokens/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

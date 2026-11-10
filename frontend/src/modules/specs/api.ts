import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Page } from "@/lib/api";
import { crudResource } from "@/lib/crud";

import type { DocKind, IdeaKind, IdeaPriority, IdeaSource, IdeaStatus } from "./labels";

// ---- documents (read-only copy of openspec/, filled by `manage.py specs_sync`)

export type SpecDoc = {
  id: number;
  path: string;
  kind: DocKind;
  /** Capability for specs, change folder for changes. */
  ref: string;
  title: string;
  requirements: number;
  synced_at: string;
};
export type SpecDocFull = SpecDoc & { content: string; sha256: string };

export function useSpecDocs(params: { q?: string }) {
  return useQuery({
    queryKey: ["specs", "documents", params],
    queryFn: async () =>
      (await api.get<Page<SpecDoc>>("/specs/documents/", { params: { size: 500, q: params.q || undefined } })).data,
    placeholderData: (prev) => prev,
  });
}

export function useSpecDoc(id: number | null) {
  return useQuery({
    queryKey: ["specs", "document", id],
    queryFn: async () => (await api.get<SpecDocFull>(`/specs/documents/${id}/`)).data,
    enabled: id != null,
  });
}

export function useSpecCheck() {
  return useQuery({
    queryKey: ["specs", "check"],
    queryFn: async () => (await api.get<{ problems: string[] }>("/specs/documents/check/")).data,
  });
}

// ---- fix ideas (takliflar)

type UserRef = { id: number; full_name: string } | null;

export type IdeaListItem = {
  id: number;
  code: string | null;
  title: string;
  kind: IdeaKind;
  capability: string;
  priority: IdeaPriority;
  status: IdeaStatus;
  source: IdeaSource;
  change_id: string;
  created_by: UserRef;
  created_at: string;
};

export type Idea = IdeaListItem & {
  problem: string;
  proposal: string;
  impact: string;
  resolution: string;
  allowed_statuses: IdeaStatus[];
  updated_at: string;
};

export type IdeaInput = Partial<{
  title: string; kind: IdeaKind; capability: string; priority: IdeaPriority; problem: string; proposal: string;
  impact: string; change_id: string;
}>;

export const ideasApi = crudResource<IdeaListItem, Idea, IdeaInput>("specs/ideas");

export function useIdeaStatus(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { status: IdeaStatus; comment?: string }) =>
      (await api.post<Idea>(`/specs/ideas/${id}/status/`, { comment: "", ...body })).data,
    onSuccess: (r) => {
      qc.setQueryData(ideasApi.keys.detail(r.id), r);
      qc.invalidateQueries({ queryKey: ideasApi.keys.all });
      qc.invalidateQueries({ queryKey: ["chatter", "specs.fixidea", r.id] });
    },
  });
}

export async function fetchProposal(id: number) {
  return (await api.get<{ markdown: string }>(`/specs/ideas/${id}/proposal/`)).data.markdown;
}

import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export type ListParams = {
  q: string;
  page: number;
  size: number;
  sort: string;
  filters: Record<string, string | string[]>;
};

const RESERVED = new Set(["q", "page", "size", "sort"]);

/**
 * List state lives in the URL (?q=&page=&sort=&status=...) so a filtered list can be
 * bookmarked, shared in Telegram, and survives "back" from a form.
 * `multi` lists filter keys that can repeat (?status=a&status=b).
 */
export function useListParams(defaults: { sort?: string; size?: number } = {}, multi: string[] = []) {
  const [sp, setSp] = useSearchParams();

  const params = useMemo<ListParams>(() => {
    const filters: ListParams["filters"] = {};
    for (const key of new Set(sp.keys())) {
      if (RESERVED.has(key)) continue;
      filters[key] = multi.includes(key) ? sp.getAll(key) : sp.get(key) ?? "";
    }
    return {
      q: sp.get("q") ?? "",
      page: Number(sp.get("page") ?? 1),
      size: Number(sp.get("size") ?? defaults.size ?? 25),
      sort: sp.get("sort") ?? defaults.sort ?? "",
      filters,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const update = useCallback(
    (patch: Partial<Omit<ListParams, "filters">> & { filters?: Record<string, string | string[] | null> }) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          const set = (k: string, v: string | number | string[] | null | undefined) => {
            next.delete(k);
            if (Array.isArray(v)) v.forEach((x) => next.append(k, x));
            else if (v !== null && v !== undefined && v !== "") next.set(k, String(v));
          };
          if ("q" in patch) set("q", patch.q);
          if ("sort" in patch) set("sort", patch.sort);
          if ("size" in patch) set("size", patch.size);
          for (const [k, v] of Object.entries(patch.filters ?? {})) set(k, v);
          // any change other than paging sends you back to page 1
          set("page", "page" in patch && patch.page !== 1 ? patch.page : null);
          return next;
        },
        { replace: true },
      );
    },
    [setSp],
  );

  /** Flat object for the API call. */
  const query = useMemo(
    () => ({ q: params.q, page: params.page, size: params.size, sort: params.sort, ...params.filters }),
    [params],
  );

  return { params, update, query };
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, tokens } from "@/lib/api";

export type PageKey =
  | "dashboard" | "projects" | "clients" | "procurement" | "mrp" | "employees" | "users" | "roles" | "references"
  | "pricing" | "company" | "crm" | "telephony";
export type PermAction = "view" | "create" | "update" | "delete";

export type Me = {
  id: number;
  username: string;
  full_name: string;
  email: string;
  is_superuser: boolean;
  roles: { id: number; name: string }[];
  permissions: Partial<Record<PageKey, PermAction[]>>;
};

type AuthCtx = {
  me: Me | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  can: (page: PageKey, action?: PermAction) => boolean;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [hasToken, setHasToken] = useState(() => !!tokens.access);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get<Me>("/auth/me/")).data,
    enabled: hasToken,
    staleTime: 60_000,
    retry: false,
  });

  const logout = useCallback(() => {
    tokens.clear();
    setHasToken(false);
    qc.clear();
  }, [qc]);

  useEffect(() => {
    window.addEventListener("rombo:logout", logout);
    return () => window.removeEventListener("rombo:logout", logout);
  }, [logout]);

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await api.post("/auth/login/", { username, password });
    tokens.set(data.access, data.refresh);
    setHasToken(true);
    await qc.invalidateQueries({ queryKey: ["me"] });
  }, [qc]);

  const me = hasToken ? meQuery.data ?? null : null;

  const can = useCallback(
    (page: PageKey, action: PermAction = "view") => !!me?.permissions[page]?.includes(action),
    [me],
  );

  const value = useMemo<AuthCtx>(
    () => ({ me, loading: hasToken && meQuery.isLoading, login, logout, can }),
    [me, hasToken, meQuery.isLoading, login, logout, can],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

/** UI-side permission check. The API enforces the same rules — this only hides controls. */
export function useCan(page: PageKey) {
  const { can } = useAuth();
  return {
    view: can(page, "view"),
    create: can(page, "create"),
    update: can(page, "update"),
    delete: can(page, "delete"),
  };
}

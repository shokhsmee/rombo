import { ShieldOff } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { Spinner } from "@/components/ui";

import { useAuth, type PageKey } from "./AuthProvider";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="grid h-screen place-items-center text-muted"><Spinner className="size-5" /></div>;
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function RequirePage({ page, children }: { page: PageKey; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(page, "view")) return <NoAccess />;
  return <>{children}</>;
}

export function NoAccess() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="grid justify-items-center gap-2 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-sunk text-muted"><ShieldOff className="size-5" /></span>
        <h2 className="t-h2">Ruxsat yo'q</h2>
        <p className="text-sm text-muted">Bu sahifani ko'rish uchun administratorga murojaat qiling.</p>
      </div>
    </div>
  );
}

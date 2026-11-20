// /settings: the one sidebar item "Sozlamalar" opens this — every settings and system page the user may see.
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "@/auth/AuthProvider";
import { SETTINGS_NAV } from "@/components/nav";
import { PageHeader } from "@/components/PageHeader";
import { Empty } from "@/components/ui";

export function SettingsHomePage() {
  const { can } = useAuth();
  const groups = SETTINGS_NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(i.page)) })).filter((g) => g.items.length);
  return (
    <>
      <PageHeader title="Sozlamalar" lede="Kamdan-kam o'zgaradigan narsalar: foydalanuvchilar, ruxsatlar, ro'yxatlar, narxlar va tizim." />
      {groups.length === 0 && <Empty>Sozlamalarga ruxsat yo'q.</Empty>}
      <div className="grid gap-6">
        {groups.map((g) => (
          <section key={g.title} className="grid gap-2">
            <h2 className="t-label px-1">{g.title}</h2>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {g.items.map((i) => (
                <Link key={i.to} to={i.to}
                  className="press group flex items-center gap-3 rounded-xl border border-line bg-surface p-3.5 transition-colors hover:border-accent hover:bg-sunk">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink">
                    <i.icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">{i.label}</span>
                    {i.about && <span className="line-clamp-2 text-xs text-muted">{i.about}</span>}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-faint group-hover:text-ink" strokeWidth={1.75} aria-hidden />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

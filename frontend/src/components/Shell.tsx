// App frame in uzbridge's layout: a 236px sidebar (sticky), a translucent top bar, the page.
import {
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Settings,
  LifeBuoy,
  Sun,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useNavigationType } from "react-router-dom";

import { useAuth } from "@/auth/AuthProvider";
import { useLiveSocket } from "@/lib/live";
import { resetTrail, useTrail, visit } from "@/lib/trail";
import { useTheme, type Theme } from "@/lib/theme";
import { TelephonyLive } from "@/modules/telephony/TelephonyLive";

import { BrandLogo } from "./Brand";
import { activeItem, hasChildItem, isSettingsPath, NAV, pageLabel, SETTINGS_NAV, type NavGroup } from "./nav";
import { Menu } from "./ui";

/** Breadcrumbs across apps (lib/trail): shown once there is somewhere to go back to. */
function TrailBar() {
  const trail = useTrail();
  if (trail.length < 2) return null;
  return (
    <nav aria-label="Yo'l" className="no-scrollbar mb-3 flex items-center gap-1 overflow-x-auto whitespace-nowrap text-sm">
      {trail.map((c, i) => {
        const last = i === trail.length - 1;
        return (
          <span key={c.path} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-faint" strokeWidth={1.75} aria-hidden />}
            {last ? <span className="font-medium text-ink">{c.label}</span>
              : <Link to={c.to} className="text-accent-ink hover:underline">{c.label}</Link>}
          </span>
        );
      })}
    </nav>
  );
}

function Row({ to, icon: Icon, label, end, active }: { to: string; icon: LucideIcon; label: string; end?: boolean; active?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={resetTrail}
      className={({ isActive }) =>
        `group/item flex items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-[7px] text-[14px] transition-colors ${
          isActive || active ? "bg-accent-soft font-semibold text-accent-ink" : "text-ink hover:bg-sunk"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`size-[18px] shrink-0 ${isActive || active ? "text-accent-ink" : "text-muted group-hover/item:text-ink"}`} strokeWidth={1.75} aria-hidden />
          {label}
        </>
      )}
    </NavLink>
  );
}

/**
 * One sidebar group: a folding line on desktop, its pages flat in the phone strip.
 * A group with one page shows that page directly.
 */
function Group({ group, open, current, onToggle }: { group: NavGroup; open: boolean; current: boolean; onToggle: () => void }) {
  if (group.items.length === 1) {
    const n = group.items[0];
    return <Row to={n.to} icon={n.icon} label={n.label} end={hasChildItem(n.to)} />;
  }
  const Icon = group.icon;
  const id = `nav-${group.title}`;
  return (
    <div className="flex gap-0.5 md:flex-col">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={id}
        className={`group/item hidden items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-[7px] text-left text-[14px] transition-colors hover:bg-sunk md:flex ${
          current && !open ? "font-semibold text-accent-ink" : "text-ink"
        }`}>
        <Icon className={`size-[18px] shrink-0 ${current ? "text-accent-ink" : "text-muted group-hover/item:text-ink"}`} strokeWidth={1.75} aria-hidden />
        <span className="flex-1">{group.title}</span>
        <ChevronDown className={`size-4 shrink-0 text-faint transition-transform duration-200 motion-reduce:transition-none ${open ? "" : "-rotate-90"}`} strokeWidth={1.75} aria-hidden />
      </button>
      {/* desktop: folds by animating the grid row; phone: always shown in the strip */}
      <div id={id} className={`md:grid md:transition-[grid-template-rows,visibility] md:duration-200 motion-reduce:transition-none ${
        open ? "md:grid-rows-[1fr]" : "md:invisible md:grid-rows-[0fr]"}`}>
        <div className="flex gap-0.5 md:ml-[19px] md:min-h-0 md:flex-col md:overflow-hidden md:border-l md:border-line md:pl-2">
          {group.items.map((n) =>
            n.planned ? (
              <span key={n.to} title="Keyingi bosqichda" className="flex cursor-default items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-[7px] text-[14px] text-faint">
                <n.icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                {n.label}
                <span className="ml-auto rounded-full bg-sunk px-1.5 py-px text-2xs font-medium text-muted">tez orada</span>
              </span>
            ) : (
              <Row key={n.to} to={n.to} icon={n.icon} label={n.label} end={hasChildItem(n.to)} />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

/** The group holding the current page (sidebar groups only; settings pages have their own item). */
function groupOf(pathname: string): string | null {
  const item = activeItem(pathname);
  return item ? NAV.find((g) => g.items.includes(item))?.title ?? null : null;
}

export function Logo({ tagline = false }: { tagline?: boolean }) {
  return <BrandLogo size={26} tagline={tagline} />;
}

function ThemeSwitch() {
  const [theme, setTheme] = useTheme();
  const opts: [Theme, LucideIcon, string][] = [["light", Sun, "Kunduzgi"], ["system", Monitor, "Tizim"], ["dark", Moon, "Tungi"]];
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
      {opts.map(([t, Icon, label]) => (
        <button key={t} type="button" onClick={() => setTheme(t)} title={label} aria-label={label}
          className={`grid size-7 place-items-center rounded-md ${theme === t ? "bg-ink text-on-ink" : "text-muted hover:text-ink"}`}>
          <Icon className="size-3.5" strokeWidth={1.75} />
        </button>
      ))}
    </div>
  );
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function TopBar() {
  const { me, can, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur md:px-8">
      <span className="truncate font-semibold text-ink">Rombo ERP</span>
      <div className="ml-auto flex items-center gap-2">
        {can("projects", "create") && (
          <Link to="/projects/new" onClick={resetTrail} className="press hidden h-8 items-center gap-1 rounded-lg bg-accent px-3 text-xs font-semibold text-white hover:bg-accent-ink sm:inline-flex">
            <Plus className="size-3.5" strokeWidth={2.25} /> Yangi loyiha
          </Link>
        )}
        <Menu
          align="right"
          trigger={(open) => (
            <button type="button" className={`flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-sunk ${open ? "bg-sunk" : ""}`}>
              <span className="grid size-7 place-items-center rounded-md bg-accent-soft text-xs font-semibold text-accent-ink">{initials(me?.full_name ?? "?")}</span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-medium">{me?.full_name}</span>
                <span className="block text-2xs text-muted">{me?.is_superuser ? "Superuser" : me?.roles.map((r) => r.name).join(", ") || "Rol yo'q"}</span>
              </span>
              <ChevronDown className="size-3.5 text-muted" />
            </button>
          )}
          items={[
            ...(me ? [{ label: "Mening hisobim", icon: <UserRound className="size-4 text-muted" />, onClick: () => navigate(`/settings/users/${me.id}`) }] : []),
            { label: "Chiqish", icon: <LogOut className="size-4" />, danger: true, onClick: () => { logout(); navigate("/login"); } },
          ]}
        />
      </div>
    </header>
  );
}

export function Shell() {
  const { can, me } = useAuth();
  useLiveSocket(!!me); // live updates (board, calls, Telegram, notifications)
  const { pathname, search } = useLocation();
  const navType = useNavigationType();
  // a new page starts at the top (block body: newer browsers return a Promise from scrollTo)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  // every page visit feeds the breadcrumb trail; list filters only refresh the crumb's link
  useEffect(() => {
    visit(pathname, search, pageLabel(pathname), navType === "REPLACE");
  }, [pathname, search, navType]);
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(i.page)) })).filter((g) => g.items.length);
  const hasSettings = SETTINGS_NAV.some((g) => g.items.some((i) => can(i.page)));
  // one group open at a time; moving to another page opens that page's group
  const current = groupOf(pathname);
  const [open, setOpen] = useState<string | null>(current);
  useEffect(() => {
    if (current) setOpen(current);
  }, [current]);

  return (
    <div className="min-h-full md:grid md:grid-cols-[236px_1fr]">
      <aside className="flex items-center gap-4 overflow-x-auto border-b border-line bg-surface px-3 py-3 md:sticky md:top-0 md:h-screen md:flex-col md:items-stretch md:gap-5 md:overflow-y-auto md:border-b-0 md:border-r md:py-5">
        <div className="shrink-0 md:px-2">
          <Logo />
          <p className="mt-1 hidden text-xs text-muted md:block">ERP · Akfa profil</p>
        </div>
        <nav className="flex gap-0.5 text-sm md:flex-col">
          {can("dashboard") && <Row to="/" end icon={LayoutDashboard} label="Bosh sahifa" />}
          {groups.map((g) => (
            <Group key={g.title} group={g} open={open === g.title} current={current === g.title}
              onToggle={() => setOpen((o) => (o === g.title ? null : g.title))} />
          ))}
          {hasSettings && <Row to="/settings" icon={Settings} label="Sozlamalar" active={isSettingsPath(pathname)} />}
          <Row to="/guide" icon={LifeBuoy} label="Qo'llanma" />
        </nav>
        <div className="hidden md:mt-auto md:flex md:px-2">
          <ThemeSwitch />
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <TopBar />
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
          <TrailBar />
          <Outlet />
        </main>
        <TelephonyLive />
      </div>
    </div>
  );
}

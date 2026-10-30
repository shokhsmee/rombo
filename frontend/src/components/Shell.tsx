// App frame in uzbridge's layout: a 236px sidebar (sticky), a translucent top bar, the page.
import {
  ArrowDownUp,
  ArrowLeftRight,
  Boxes,
  Package,
  Warehouse,
  Building,
  ChevronRight,
  Building2,
  BookOpen,
  NotebookText,
  ChevronDown,
  FileSpreadsheet,
  Factory,
  FileText,
  LayoutDashboard,
  Layers,
  LogOut,
  MapPinned,
  Monitor,
  PackageCheck,
  ClipboardList,
  HandCoins,
  ListOrdered,
  Truck,
  Moon,
  Plus,
  ListChecks,
  ListTree,
  Receipt,
  Tags,
  PhoneCall,
  Send,
  SquareKanban,
  ShieldCheck,
  ShoppingCart,
  Sun,
  UserRound,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useNavigationType } from "react-router-dom";

import { useAuth, type PageKey } from "@/auth/AuthProvider";
import { useLiveSocket } from "@/lib/live";
import { resetTrail, useTrail, visit } from "@/lib/trail";
import { useTheme, type Theme } from "@/lib/theme";
import { TelephonyLive } from "@/modules/telephony/TelephonyLive";

import { BrandLogo } from "./Brand";
import { Menu } from "./ui";

type NavItem = { page: PageKey; label: string; to: string; icon: LucideIcon; planned?: boolean };
type NavGroup = { title: string; items: NavItem[] };

// Same page keys as backend apps/access/registry.py
const NAV: NavGroup[] = [
  {
    title: "Savdo",
    items: [
      { page: "projects", label: "Loyihalar", to: "/projects", icon: FileText },
      { page: "clients", label: "Mijozlar", to: "/clients", icon: Building2 },
    ],
  },
  {
    title: "CRM",
    items: [
      { page: "crm", label: "Voronka", to: "/crm", icon: SquareKanban },
      { page: "client_map", label: "Mijozlar xaritasi", to: "/crm/map", icon: MapPinned },
      { page: "telephony", label: "Qo'ng'iroqlar", to: "/telephony", icon: PhoneCall },
      { page: "telegram", label: "Telegram", to: "/telegram", icon: Send },
    ],
  },
  {
    title: "Ta'minot",
    items: [
      { page: "procurement", label: "Xarid so'rovlari", to: "/procurement/requests", icon: ClipboardList },
      { page: "purchase_orders", label: "Buyurtmalar", to: "/procurement/orders", icon: ShoppingCart },
      { page: "goods_receipts", label: "Kirim", to: "/procurement/receipts", icon: PackageCheck },
      { page: "suppliers", label: "Yetkazib beruvchilar", to: "/procurement/suppliers", icon: Truck },
    ],
  },
  {
    title: "Ishlab chiqarish",
    items: [
      { page: "bom", label: "Tarkiblar (BOM)", to: "/mrp/boms", icon: Layers },
      { page: "mrp", label: "MRP", to: "/mrp", icon: Factory },
    ],
  },
  {
    title: "Ombor",
    items: [
      { page: "inventory", label: "Ombor", to: "/inventory/moves", icon: ArrowDownUp },
      { page: "stock", label: "Qoldiqlar", to: "/inventory/stock", icon: Boxes },
      { page: "products", label: "Mahsulotlar", to: "/inventory/products", icon: Package },
      { page: "warehouses", label: "Omborlar", to: "/inventory/warehouses", icon: Warehouse },
    ],
  },
  {
    title: "Moliya",
    items: [
      { page: "kassa", label: "Kassa va bank", to: "/kassa", icon: Wallet },
      { page: "cash_orders", label: "Kirim / chiqim", to: "/kassa/orders", icon: ArrowLeftRight },
      { page: "cash_book", label: "Kassa kitobi", to: "/kassa/book", icon: NotebookText },
      { page: "payment_requests", label: "Pul so'rovlari", to: "/kassa/payment-requests", icon: HandCoins },
    ],
  },
  {
    title: "Buxgalteriya",
    items: [
      { page: "accounting", label: "Jurnal", to: "/accounting", icon: BookOpen },
      { page: "invoices", label: "Hisob-fakturalar", to: "/accounting/invoices", icon: Receipt },
      { page: "accounting_reports", label: "Hisobotlar", to: "/accounting/reports", icon: FileSpreadsheet },
      { page: "accounts", label: "Hisoblar rejasi", to: "/accounting/accounts", icon: ListTree },
    ],
  },
  { title: "Xodimlar", items: [{ page: "employees", label: "Xodimlar", to: "/employees", icon: UsersRound }] },
  {
    title: "Sozlamalar",
    items: [
      { page: "users", label: "Foydalanuvchilar", to: "/settings/users", icon: Users },
      { page: "roles", label: "Rollar va ruxsatlar", to: "/settings/roles", icon: ShieldCheck },
      { page: "references", label: "Ma'lumotnomalar", to: "/settings/references", icon: ListChecks },
      { page: "pricing", label: "Narxlar", to: "/settings/pricing", icon: Tags },
      { page: "company", label: "Kompaniya", to: "/settings/company", icon: Building },
      { page: "approval_steps", label: "Tasdiqlash bosqichlari", to: "/settings/approval-steps", icon: ListOrdered },
    ],
  },
];

/** The crumb label of a page before it names itself: the sidebar item with the longest matching path. */
function pageLabel(pathname: string): string {
  if (pathname === "/") return "Bosh sahifa";
  let best = { len: 0, label: "Sahifa" };
  for (const g of NAV) for (const i of g.items) {
    if ((pathname === i.to || pathname.startsWith(`${i.to}/`)) && i.to.length > best.len) best = { len: i.to.length, label: i.label };
  }
  return best.label;
}

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

/** /crm must not light up on /crm/map: an item whose path prefixes another item's matches exactly. */
const hasChildItem = (to: string) => NAV.some((g) => g.items.some((i) => i.to !== to && i.to.startsWith(`${to}/`)));

function Row({ to, icon: Icon, label, end }: { to: string; icon: LucideIcon; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={resetTrail}
      className={({ isActive }) =>
        `group/item flex items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-[7px] text-[14px] transition-colors ${
          isActive ? "bg-accent-soft font-semibold text-accent-ink" : "text-ink hover:bg-sunk"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`size-[18px] shrink-0 ${isActive ? "text-accent-ink" : "text-muted group-hover/item:text-ink"}`} strokeWidth={1.75} aria-hidden />
          {label}
        </>
      )}
    </NavLink>
  );
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

  return (
    <div className="min-h-full md:grid md:grid-cols-[236px_1fr]">
      <aside className="flex items-center gap-4 overflow-x-auto border-b border-line bg-surface px-3 py-3 md:sticky md:top-0 md:h-screen md:flex-col md:items-stretch md:gap-5 md:overflow-y-auto md:border-b-0 md:border-r md:py-5">
        <div className="shrink-0 md:px-2">
          <Logo />
          <p className="mt-1 hidden text-xs text-muted md:block">ERP · Akfa profil</p>
        </div>
        <nav className="flex gap-1 text-sm md:flex-col md:gap-5">
          {can("dashboard") && (
            <div className="flex md:flex-col"><Row to="/" end icon={LayoutDashboard} label="Bosh sahifa" /></div>
          )}
          {groups.map((g) => (
            <div key={g.title} className="flex gap-1 md:flex-col">
              <p className="t-label hidden px-2.5 pb-1 md:block">{g.title}</p>
              <div className="flex gap-0.5 md:flex-col">
                {g.items.map((n) =>
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
          ))}
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

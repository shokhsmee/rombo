// The app menu: the sidebar groups (NAV) and the pages behind the one "Sozlamalar" item (SETTINGS_NAV).
// Page keys are the same as backend apps/access/registry.py.
import {
  ArrowDownUp,
  ArrowLeftRight,
  BookMarked,
  BookOpen,
  Bot,
  Boxes,
  Building,
  Building2,
  ClipboardList,
  Factory,
  FileSpreadsheet,
  FileText,
  Frame,
  HandCoins,
  Handshake,
  HardHat,
  Layers,
  Lightbulb,
  ListChecks,
  ListOrdered,
  ListTree,
  MapPinned,
  NotebookText,
  Package,
  PackageCheck,
  PhoneCall,
  Receipt,
  Send,
  ShieldCheck,
  ShoppingCart,
  SquareKanban,
  Tags,
  Truck,
  Users,
  UsersRound,
  Wallet,
  Warehouse,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { PageKey } from "@/auth/AuthProvider";
import { PAGE_MASTERS, PAGE_REQUESTS } from "@/modules/maintenance/labels";

export type NavItem = { page: PageKey; label: string; to: string; icon: LucideIcon; planned?: boolean; about?: string };
export type NavGroup = { title: string; icon: LucideIcon; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    title: "Savdo",
    icon: Handshake,
    items: [
      { page: "projects", label: "Loyihalar", to: "/projects", icon: FileText },
      { page: "clients", label: "Mijozlar", to: "/clients", icon: Building2 },
    ],
  },
  {
    title: "CRM",
    icon: SquareKanban,
    items: [
      { page: "crm", label: "Voronka", to: "/crm", icon: SquareKanban },
      { page: "client_map", label: "Mijozlar xaritasi", to: "/crm/map", icon: MapPinned },
      { page: "telephony", label: "Qo'ng'iroqlar", to: "/telephony", icon: PhoneCall },
      { page: "telegram", label: "Telegram", to: "/telegram", icon: Send },
    ],
  },
  {
    title: "Servis",
    icon: Wrench,
    items: [
      { page: PAGE_REQUESTS, label: "Arizalar", to: "/service", icon: Wrench },
      { page: PAGE_MASTERS, label: "Ustalar", to: "/service/masters", icon: HardHat },
    ],
  },
  {
    title: "Ta'minot",
    icon: Truck,
    items: [
      { page: "procurement", label: "Xarid so'rovlari", to: "/procurement/requests", icon: ClipboardList },
      { page: "purchase_orders", label: "Buyurtmalar", to: "/procurement/orders", icon: ShoppingCart },
      { page: "goods_receipts", label: "Kirim", to: "/procurement/receipts", icon: PackageCheck },
      { page: "suppliers", label: "Yetkazib beruvchilar", to: "/procurement/suppliers", icon: Truck },
    ],
  },
  {
    title: "Ishlab chiqarish",
    icon: Factory,
    items: [
      { page: "bom", label: "Tarkiblar (BOM)", to: "/mrp/boms", icon: Layers },
      { page: "mrp", label: "MRP", to: "/mrp", icon: Factory },
    ],
  },
  {
    title: "Ombor",
    icon: Warehouse,
    items: [
      { page: "inventory", label: "Ombor", to: "/inventory/moves", icon: ArrowDownUp },
      { page: "stock", label: "Qoldiqlar", to: "/inventory/stock", icon: Boxes },
      { page: "products", label: "Mahsulotlar", to: "/inventory/products", icon: Package },
      { page: "warehouses", label: "Omborlar", to: "/inventory/warehouses", icon: Warehouse },
    ],
  },
  {
    title: "Moliya",
    icon: Wallet,
    items: [
      { page: "kassa", label: "Kassa va bank", to: "/kassa", icon: Wallet },
      { page: "cash_orders", label: "Kirim / chiqim", to: "/kassa/orders", icon: ArrowLeftRight },
      { page: "cash_book", label: "Kassa kitobi", to: "/kassa/book", icon: NotebookText },
      { page: "payment_requests", label: "Pul so'rovlari", to: "/kassa/payment-requests", icon: HandCoins },
    ],
  },
  {
    title: "Buxgalteriya",
    icon: BookOpen,
    items: [
      { page: "accounting", label: "Jurnal", to: "/accounting", icon: BookOpen },
      { page: "invoices", label: "Hisob-fakturalar", to: "/accounting/invoices", icon: Receipt },
      { page: "accounting_reports", label: "Hisobotlar", to: "/accounting/reports", icon: FileSpreadsheet },
      { page: "accounts", label: "Hisoblar rejasi", to: "/accounting/accounts", icon: ListTree },
    ],
  },
  { title: "Xodimlar", icon: UsersRound, items: [{ page: "employees", label: "Xodimlar", to: "/employees", icon: UsersRound }] },
];

/** Opened from the one sidebar item "Sozlamalar" (/settings): rarely used pages, shown as cards. */
export const SETTINGS_NAV: NavGroup[] = [
  {
    title: "Sozlamalar",
    icon: ListChecks,
    items: [
      { page: "users", label: "Foydalanuvchilar", to: "/settings/users", icon: Users, about: "Tizimga kiradigan hisoblar va rollari" },
      { page: "roles", label: "Rollar va ruxsatlar", to: "/settings/roles", icon: ShieldCheck, about: "Har sahifa uchun ko'rish, yaratish, tahrirlash, o'chirish" },
      { page: "references", label: "Ma'lumotnomalar", to: "/settings/references", icon: ListChecks, about: "Loyiha va mijoz kartochkasidagi tanlov ro'yxatlari" },
      { page: "pricing", label: "Narxlar", to: "/settings/pricing", icon: Tags, about: "Seriyalar bo'yicha komplektlovchilar va narxlar" },
      { page: "profile_systems", label: "Profil tizimlari", to: "/settings/profile-systems", icon: Frame, about: "Konstruktor seriyalari va sex qoidalari" },
      { page: "company", label: "Kompaniya", to: "/settings/company", icon: Building, about: "Rekvizitlar, bank, shartnoma shartlari" },
      { page: "approval_steps", label: "Tasdiqlash bosqichlari", to: "/settings/approval-steps", icon: ListOrdered, about: "Xarid so'rovi qaysi rollar orqali tasdiqlanadi" },
    ],
  },
  {
    title: "Tizim",
    icon: Bot,
    items: [
      { page: "mcp", label: "Claude ulanish", to: "/system/claude", icon: Bot, about: "Claude sizning nomingizdan ishlaydi" },
      { page: "specs", label: "Spetsifikatsiyalar", to: "/system/specs", icon: BookMarked, about: "Tizim qanday ishlashi kerak (OpenSpec)" },
      { page: "fix_ideas", label: "Takliflar", to: "/system/ideas", icon: Lightbulb, about: "Tuzatish g'oyalari" },
    ],
  },
];

export const SETTINGS_PATHS = ["/settings", "/system"];

export const isSettingsPath = (pathname: string) =>
  SETTINGS_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

const ALL_ITEMS = [...NAV, ...SETTINGS_NAV].flatMap((g) => g.items);

/** The crumb label of a page before it names itself: the menu item with the longest matching path. */
export function pageLabel(pathname: string): string {
  if (pathname === "/") return "Bosh sahifa";
  if (pathname === "/settings") return "Sozlamalar";
  let best = { len: 0, label: "Sahifa" };
  for (const i of ALL_ITEMS) {
    if ((pathname === i.to || pathname.startsWith(`${i.to}/`)) && i.to.length > best.len) best = { len: i.to.length, label: i.label };
  }
  return best.label;
}

/** /crm must not light up on /crm/map: an item whose path prefixes another item's matches exactly. */
export const hasChildItem = (to: string) => ALL_ITEMS.some((i) => i.to !== to && i.to.startsWith(`${to}/`));

/** The item the current path belongs to (longest prefix), so its group can open by itself. */
export function activeItem(pathname: string): NavItem | undefined {
  let best: NavItem | undefined;
  for (const i of ALL_ITEMS) {
    if ((pathname === i.to || pathname.startsWith(`${i.to}/`)) && (!best || i.to.length > best.to.length)) best = i;
  }
  return best;
}

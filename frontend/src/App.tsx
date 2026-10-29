import { lazy, Suspense, type ReactNode } from "react";
import { Route, Routes } from "react-router-dom";

import { RequireAuth, RequirePage } from "@/auth/Guards";
import { Shell } from "@/components/Shell";
import { RoleFormPage } from "@/modules/access/RoleFormPage";
import { RolesListPage } from "@/modules/access/RolesListPage";
import { LoginPage } from "@/modules/auth/LoginPage";
import { ClientFormPage } from "@/modules/clients/ClientFormPage";
import { ClientMapPage } from "@/modules/clients/ClientMapPage";
import { ClientsListPage } from "@/modules/clients/ClientsListPage";
import { DashboardPage } from "@/modules/dashboard/DashboardPage";
import { EmployeeFormPage } from "@/modules/employees/EmployeeFormPage";
import { EmployeesListPage } from "@/modules/employees/EmployeesListPage";
import { ProjectFormPage } from "@/modules/projects/ProjectFormPage";
import { ProjectsListPage } from "@/modules/projects/ProjectsListPage";
import { CalcPage } from "@/modules/projects/CalcPage";
import { ContractPrint } from "@/modules/projects/print/ContractPrint";
import { InvoicePrint } from "@/modules/projects/print/InvoicePrint";
import { CompanyPage } from "@/modules/company/CompanyPage";
import { PriceListFormPage } from "@/modules/pricing/PriceListFormPage";
import { PriceListsPage } from "@/modules/pricing/PriceListsPage";
import { ReferencesPage } from "@/modules/references/ReferencesPage";
import { UserFormPage } from "@/modules/users/UserFormPage";
import { UsersListPage } from "@/modules/users/UsersListPage";

// Bigger pages that most visits never open load on demand.
const AnalyticsPage = lazy(() => import("@/modules/crm/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })));
const CrmSettingsPage = lazy(() => import("@/modules/crm/SettingsPage").then((m) => ({ default: m.CrmSettingsPage })));
const TelegramPage = lazy(() => import("@/modules/telegram/TelegramPage").then((m) => ({ default: m.TelegramPage })));
const TelephonySettingsPage = lazy(() => import("@/modules/telephony/SettingsPage").then((m) => ({ default: m.TelephonySettingsPage })));
const BoardPage = lazy(() => import("@/modules/crm/BoardPage").then((m) => ({ default: m.BoardPage })));
const LeadFormPage = lazy(() => import("@/modules/crm/LeadFormPage").then((m) => ({ default: m.LeadFormPage })));
const CallsPage = lazy(() => import("@/modules/telephony/CallsPage").then((m) => ({ default: m.CallsPage })));
const JournalListPage = lazy(() => import("@/modules/accounting/JournalListPage").then((m) => ({ default: m.JournalListPage })));
const EntryPage = lazy(() => import("@/modules/accounting/EntryPage").then((m) => ({ default: m.EntryPage })));
const AccountsPage = lazy(() => import("@/modules/accounting/AccountsPage").then((m) => ({ default: m.AccountsPage })));
const InvoicesListPage = lazy(() => import("@/modules/accounting/InvoicesListPage").then((m) => ({ default: m.InvoicesListPage })));
const InvoiceFormPage = lazy(() => import("@/modules/accounting/InvoiceFormPage").then((m) => ({ default: m.InvoiceFormPage })));
const ReportsPage = lazy(() => import("@/modules/accounting/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const ReconciliationPrint = lazy(() => import("@/modules/accounting/print/ReconciliationPrint").then((m) => ({ default: m.ReconciliationPrint })));
const KassaPage = lazy(() => import("@/modules/kassa/KassaPage").then((m) => ({ default: m.KassaPage })));
const CashOrdersListPage = lazy(() => import("@/modules/kassa/CashOrdersListPage").then((m) => ({ default: m.CashOrdersListPage })));
const CashOrderFormPage = lazy(() => import("@/modules/kassa/CashOrderFormPage").then((m) => ({ default: m.CashOrderFormPage })));
const CashBookPage = lazy(() => import("@/modules/kassa/CashBookPage").then((m) => ({ default: m.CashBookPage })));
const CashOrderPrint = lazy(() => import("@/modules/kassa/print/CashOrderPrint").then((m) => ({ default: m.CashOrderPrint })));
const Later = ({ children }: { children: ReactNode }) => <Suspense fallback={null}>{children}</Suspense>;

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* paper documents: no app chrome, opened in a new tab and printed to PDF */}
      <Route path="/print/projects/:id/calcs/:calcId" element={<RequireAuth><RequirePage page="projects"><InvoicePrint /></RequirePage></RequireAuth>} />
      <Route path="/print/projects/:id/contract" element={<RequireAuth><RequirePage page="projects"><ContractPrint /></RequirePage></RequireAuth>} />
      <Route path="/print/accounting/reconciliation" element={<RequireAuth><RequirePage page="accounting_reports"><Later><ReconciliationPrint /></Later></RequirePage></RequireAuth>} />
      <Route path="/print/kassa/orders/:id" element={<RequireAuth><RequirePage page="cash_orders"><Later><CashOrderPrint /></Later></RequirePage></RequireAuth>} />
      <Route element={<RequireAuth><Shell /></RequireAuth>}>
        <Route index element={<DashboardPage />} />

        <Route path="projects" element={<RequirePage page="projects"><ProjectsListPage /></RequirePage>} />
        <Route path="projects/:id" element={<RequirePage page="projects"><ProjectFormPage /></RequirePage>} />
        <Route path="projects/:id/calcs/:calcId" element={<RequirePage page="projects"><CalcPage /></RequirePage>} />

        <Route path="clients" element={<RequirePage page="clients"><ClientsListPage /></RequirePage>} />
        <Route path="clients/:id" element={<RequirePage page="clients"><ClientFormPage /></RequirePage>} />

        <Route path="crm" element={<RequirePage page="crm"><Later><BoardPage /></Later></RequirePage>} />
        <Route path="crm/leads/:id" element={<RequirePage page="crm"><Later><LeadFormPage /></Later></RequirePage>} />
        <Route path="crm/analytics" element={<RequirePage page="crm"><Later><AnalyticsPage /></Later></RequirePage>} />
        <Route path="crm/settings" element={<RequirePage page="crm"><Later><CrmSettingsPage /></Later></RequirePage>} />
        <Route path="telegram" element={<RequirePage page="telegram"><Later><TelegramPage tab="chats" /></Later></RequirePage>} />
        <Route path="telegram/accounts" element={<RequirePage page="telegram"><Later><TelegramPage tab="accounts" /></Later></RequirePage>} />
        <Route path="telephony" element={<RequirePage page="telephony"><Later><CallsPage /></Later></RequirePage>} />
        <Route path="telephony/settings" element={<RequirePage page="telephony"><Later><TelephonySettingsPage /></Later></RequirePage>} />
        <Route path="crm/map" element={<RequirePage page="client_map"><RequirePage page="clients"><ClientMapPage /></RequirePage></RequirePage>} />

        <Route path="accounting" element={<RequirePage page="accounting"><Later><JournalListPage /></Later></RequirePage>} />
        <Route path="accounting/entries/:id" element={<RequirePage page="accounting"><Later><EntryPage /></Later></RequirePage>} />
        <Route path="accounting/invoices" element={<RequirePage page="invoices"><Later><InvoicesListPage /></Later></RequirePage>} />
        <Route path="accounting/invoices/:id" element={<RequirePage page="invoices"><Later><InvoiceFormPage /></Later></RequirePage>} />
        <Route path="accounting/reports" element={<RequirePage page="accounting_reports"><Later><ReportsPage /></Later></RequirePage>} />
        <Route path="accounting/accounts" element={<RequirePage page="accounts"><Later><AccountsPage /></Later></RequirePage>} />

        <Route path="kassa" element={<RequirePage page="kassa"><Later><KassaPage /></Later></RequirePage>} />
        <Route path="kassa/orders" element={<RequirePage page="cash_orders"><Later><CashOrdersListPage /></Later></RequirePage>} />
        <Route path="kassa/orders/:id" element={<RequirePage page="cash_orders"><Later><CashOrderFormPage /></Later></RequirePage>} />
        <Route path="kassa/book" element={<RequirePage page="cash_book"><Later><CashBookPage /></Later></RequirePage>} />

        <Route path="employees" element={<RequirePage page="employees"><EmployeesListPage /></RequirePage>} />
        <Route path="employees/:id" element={<RequirePage page="employees"><EmployeeFormPage /></RequirePage>} />

        <Route path="settings/users" element={<RequirePage page="users"><UsersListPage /></RequirePage>} />
        <Route path="settings/users/:id" element={<RequirePage page="users"><UserFormPage /></RequirePage>} />
        <Route path="settings/roles" element={<RequirePage page="roles"><RolesListPage /></RequirePage>} />
        <Route path="settings/roles/:id" element={<RequirePage page="roles"><RoleFormPage /></RequirePage>} />

        <Route path="settings/references" element={<RequirePage page="references"><ReferencesPage /></RequirePage>} />
        <Route path="settings/pricing" element={<RequirePage page="pricing"><PriceListsPage /></RequirePage>} />
        <Route path="settings/pricing/:id" element={<RequirePage page="pricing"><PriceListFormPage /></RequirePage>} />
        <Route path="settings/company" element={<RequirePage page="company"><CompanyPage /></RequirePage>} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <h2 className="t-h2">Sahifa topilmadi</h2>
        <p className="mt-1 text-sm text-muted">Manzilni tekshiring yoki chap menyudan tanlang.</p>
      </div>
    </div>
  );
}

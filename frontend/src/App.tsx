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
const Later = ({ children }: { children: ReactNode }) => <Suspense fallback={null}>{children}</Suspense>;

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* paper documents: no app chrome, opened in a new tab and printed to PDF */}
      <Route path="/print/projects/:id/calcs/:calcId" element={<RequireAuth><RequirePage page="projects"><InvoicePrint /></RequirePage></RequireAuth>} />
      <Route path="/print/projects/:id/contract" element={<RequireAuth><RequirePage page="projects"><ContractPrint /></RequirePage></RequireAuth>} />
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

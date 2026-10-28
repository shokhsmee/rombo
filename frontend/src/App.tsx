import { Route, Routes } from "react-router-dom";

import { RequireAuth, RequirePage } from "@/auth/Guards";
import { Shell } from "@/components/Shell";
import { RoleFormPage } from "@/modules/access/RoleFormPage";
import { RolesListPage } from "@/modules/access/RolesListPage";
import { LoginPage } from "@/modules/auth/LoginPage";
import { ClientFormPage } from "@/modules/clients/ClientFormPage";
import { ClientsListPage } from "@/modules/clients/ClientsListPage";
import { BoardPage } from "@/modules/crm/BoardPage";
import { LeadFormPage } from "@/modules/crm/LeadFormPage";
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
import { CallsPage } from "@/modules/telephony/CallsPage";
import { TelephonySettingsPage } from "@/modules/telephony/SettingsPage";
import { UserFormPage } from "@/modules/users/UserFormPage";
import { UsersListPage } from "@/modules/users/UsersListPage";

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

        <Route path="crm" element={<RequirePage page="crm"><BoardPage /></RequirePage>} />
        <Route path="crm/leads/:id" element={<RequirePage page="crm"><LeadFormPage /></RequirePage>} />
        <Route path="telephony" element={<RequirePage page="telephony"><CallsPage /></RequirePage>} />
        <Route path="telephony/settings" element={<RequirePage page="telephony"><TelephonySettingsPage /></RequirePage>} />

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

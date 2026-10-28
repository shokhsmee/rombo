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
import { ReferencesPage } from "@/modules/references/ReferencesPage";
import { UserFormPage } from "@/modules/users/UserFormPage";
import { UsersListPage } from "@/modules/users/UsersListPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth><Shell /></RequireAuth>}>
        <Route index element={<DashboardPage />} />

        <Route path="projects" element={<RequirePage page="projects"><ProjectsListPage /></RequirePage>} />
        <Route path="projects/:id" element={<RequirePage page="projects"><ProjectFormPage /></RequirePage>} />

        <Route path="clients" element={<RequirePage page="clients"><ClientsListPage /></RequirePage>} />
        <Route path="clients/:id" element={<RequirePage page="clients"><ClientFormPage /></RequirePage>} />

        <Route path="crm/map" element={<RequirePage page="client_map"><RequirePage page="clients"><ClientMapPage /></RequirePage></RequirePage>} />

        <Route path="employees" element={<RequirePage page="employees"><EmployeesListPage /></RequirePage>} />
        <Route path="employees/:id" element={<RequirePage page="employees"><EmployeeFormPage /></RequirePage>} />

        <Route path="settings/users" element={<RequirePage page="users"><UsersListPage /></RequirePage>} />
        <Route path="settings/users/:id" element={<RequirePage page="users"><UserFormPage /></RequirePage>} />
        <Route path="settings/roles" element={<RequirePage page="roles"><RolesListPage /></RequirePage>} />
        <Route path="settings/roles/:id" element={<RequirePage page="roles"><RoleFormPage /></RequirePage>} />

        <Route path="settings/references" element={<RequirePage page="references"><ReferencesPage /></RequirePage>} />

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

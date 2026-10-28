import { Center, Text, Title } from "@mantine/core";
import { Route, Routes } from "react-router-dom";

import { RequireAuth, RequirePage } from "@/auth/Guards";
import { Layout } from "@/components/Layout";
import { RoleFormPage } from "@/modules/access/RoleFormPage";
import { RolesListPage } from "@/modules/access/RolesListPage";
import { LoginPage } from "@/modules/auth/LoginPage";
import { ClientFormPage } from "@/modules/clients/ClientFormPage";
import { ClientsListPage } from "@/modules/clients/ClientsListPage";
import { DashboardPage } from "@/modules/dashboard/DashboardPage";
import { EmployeeFormPage } from "@/modules/employees/EmployeeFormPage";
import { EmployeesListPage } from "@/modules/employees/EmployeesListPage";
import { ProjectFormPage } from "@/modules/projects/ProjectFormPage";
import { ProjectsListPage } from "@/modules/projects/ProjectsListPage";
import { UserFormPage } from "@/modules/users/UserFormPage";
import { UsersListPage } from "@/modules/users/UsersListPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<DashboardPage />} />

        <Route path="projects" element={<RequirePage page="projects"><ProjectsListPage /></RequirePage>} />
        <Route path="projects/:id" element={<RequirePage page="projects"><ProjectFormPage key="p" /></RequirePage>} />

        <Route path="clients" element={<RequirePage page="clients"><ClientsListPage /></RequirePage>} />
        <Route path="clients/:id" element={<RequirePage page="clients"><ClientFormPage /></RequirePage>} />

        <Route path="employees" element={<RequirePage page="employees"><EmployeesListPage /></RequirePage>} />
        <Route path="employees/:id" element={<RequirePage page="employees"><EmployeeFormPage /></RequirePage>} />

        <Route path="settings/users" element={<RequirePage page="users"><UsersListPage /></RequirePage>} />
        <Route path="settings/users/:id" element={<RequirePage page="users"><UserFormPage /></RequirePage>} />
        <Route path="settings/roles" element={<RequirePage page="roles"><RolesListPage /></RequirePage>} />
        <Route path="settings/roles/:id" element={<RequirePage page="roles"><RoleFormPage /></RequirePage>} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function NotFound() {
  return (
    <Center h="60vh" style={{ flexDirection: "column" }}>
      <Title order={2}>Sahifa topilmadi</Title>
      <Text c="dimmed" size="sm">Manzilni tekshiring yoki chap menyudan tanlang.</Text>
    </Center>
  );
}

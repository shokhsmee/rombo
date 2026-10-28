import { Center, Loader, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth, type PageKey } from "./AuthProvider";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <Center h="100vh">
        <Loader size="sm" />
      </Center>
    );
  }
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
    <Center h="60vh">
      <Stack gap={4} align="center">
        <Title order={2}>Ruxsat yo'q</Title>
        <Text c="dimmed" size="sm">
          Bu sahifani ko'rish uchun administratorga murojaat qiling.
        </Text>
      </Stack>
    </Center>
  );
}

import { useMutation } from "@tanstack/react-query";

import type { PageKey, PermAction } from "@/auth/AuthProvider";
import { api } from "@/lib/api";
import { crudResource } from "@/lib/crud";

export type UserListItem = {
  id: number;
  username: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  is_superuser: boolean;
  last_login: string | null;
  roles: { id: number; name: string }[];
};

export type User = UserListItem & {
  permissions: Partial<Record<PageKey, PermAction[]>>;
  employee: { id: number; code: string; name: string } | null;
  date_joined: string;
};

export type UserInput = Partial<{
  username: string; first_name: string; last_name: string; email: string; phone: string;
  is_active: boolean; is_superuser: boolean; role_ids: number[]; password: string;
}>;

export const usersApi = crudResource<UserListItem, User, UserInput>("users");

export function useResetPassword(id: number) {
  return useMutation({
    mutationFn: async (password: string) => api.post(`/users/${id}/reset-password/`, { password }),
  });
}

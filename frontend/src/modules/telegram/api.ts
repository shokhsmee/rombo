import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api, type Ref } from "@/lib/api";

export type TgStatus = "new" | "code_sent" | "password" | "connected" | "error";
export type Account = {
  id: number; owner: { id: number; full_name: string }; name: string; phone: string; status: TgStatus; error: string;
  connected: boolean; tg_name: string; tg_username: string; auto_clients: boolean; crm_leads: boolean; active: boolean;
  last_sync: string | null; own_api: boolean; api_id: number | null; chats: number; live: boolean; mine?: boolean;
};
export type AccountsResponse = { accounts: Account[]; default_api: boolean; can_manage: boolean; crm: boolean };

export type Chat = {
  id: number; account_id: number; chat_id: number; kind: "private" | "group" | "channel"; name: string; username: string;
  phone: string; client: Ref | null; lead: { id: number; code: string; name: string } | null; unread: number;
  last_read_out: number; last_at: string | null; last_out: boolean; photo: number | null; active: boolean;
  last?: Message | null;
};
export type Message = {
  tg_id: number; out: boolean; date: string; text: string; edited?: boolean; reactions?: { emoji: string; count: number }[];
  media?: string; sender_id?: number | null; sender_name?: string; file?: { name: string; mime: string; size: number } | null;
  pending?: boolean;
};

export const TG_STATUS: Record<TgStatus, string> = {
  new: "Ulanmagan", code_sent: "Kod yuborildi", password: "2FA parol kerak", connected: "Ulangan", error: "Xato",
};

export function useAccounts() {
  return useQuery({ queryKey: ["telegram/accounts"], queryFn: async () => (await api.get<AccountsResponse>("/telegram/accounts/")).data });
}

export function useChats() {
  return useQuery({ queryKey: ["telegram/chats"], queryFn: async () => (await api.get<Chat[]>("/telegram/chats/")).data });
}

/** Fresh previews from Telegram (shown, never stored); merged over the stored list. */
export function useLiveChats() {
  return useQuery({ queryKey: ["telegram/chats", "live"], queryFn: async () => (await api.get<Chat[]>("/telegram/chats/live/")).data, retry: false, staleTime: 60_000 });
}

export function useAccountAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, body }: { id?: number; action: "create" | "update" | "delete" | "send-code" | "sign-in" | "sync" | "disconnect"; body?: Record<string, unknown> }) => {
      if (action === "create") return (await api.post("/telegram/accounts/", body)).data;
      if (action === "update") return (await api.patch(`/telegram/accounts/${id}/`, body)).data;
      if (action === "delete") return (await api.delete(`/telegram/accounts/${id}/`)).data;
      return (await api.post(`/telegram/accounts/${id}/${action}/`, body)).data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["telegram/accounts"] }); qc.invalidateQueries({ queryKey: ["telegram/chats"] }); },
  });
}

/** A blob URL for something behind the API's auth (avatars, media): <img src> can't send the token. */
export function useBlobUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    let gone = false;
    let made: string | null = null;
    api.get(path, { responseType: "blob" }).then((r) => {
      if (gone) return;
      made = URL.createObjectURL(r.data);
      setUrl(made);
    }).catch(() => undefined);
    return () => { gone = true; if (made) URL.revokeObjectURL(made); };
  }, [path]);
  return url;
}

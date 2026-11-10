import axios, { AxiosError } from "axios";

import { tg } from "./tg";

export type BotKind = "client" | "master";

// Outside Telegram (local preview) the backend accepts "dev <telegram id>" when DEBUG and SERVICE_MINIAPP_DEV
// are on. Open /app/client/?dev=123456 once; the id is kept for the tab.
function authHeader(): string | undefined {
  if (tg?.initData) return `tma ${tg.initData}`;
  const fromUrl = new URLSearchParams(window.location.search).get("dev");
  if (fromUrl) sessionStorage.setItem("rombo.miniapp.dev", fromUrl);
  const dev = sessionStorage.getItem("rombo.miniapp.dev");
  return dev ? `dev ${dev}` : undefined;
}

export function appApi(kind: BotKind) {
  const http = axios.create({ baseURL: `/api/v1/maintenance/app/${kind}` });
  http.interceptors.request.use((cfg) => {
    const h = authHeader();
    if (h) cfg.headers.Authorization = h;
    return cfg;
  });
  return http;
}

export interface ApiError {
  status: number;
  message: string;
  field?: string | null;
}

export function toError(e: unknown): ApiError {
  const ax = e as AxiosError<{ error?: { message?: string; field?: string } }>;
  const status = ax.response?.status ?? 0;
  const message =
    ax.response?.data?.error?.message ||
    (status === 0 ? "Internet aloqasi yo'q" : status >= 500 ? "Serverda xatolik. Keyinroq urinib ko'ring." : "Xatolik");
  return { status, message, field: ax.response?.data?.error?.field };
}

// ---- shapes (apps/maintenance/serializers.py: AppRequestSerializer / AppJobSerializer)

export type Status = "new" | "assigned" | "accepted" | "in_progress" | "done" | "closed" | "cancelled";

export interface Photo {
  id: number;
  stage: "before" | "after";
  url: string;
}

export interface AppRequest {
  id: number;
  code: string;
  status: Status;
  status_label: string;
  kind: string;
  kind_label: string;
  description: string;
  address: string;
  preferred_date: string | null;
  scheduled_at: string | null;
  is_warranty: boolean;
  master: { name: string; phone: string } | null;
  project: { id: number; code: string; name: string } | null;
  report: string;
  rating: number | null;
  feedback: string;
  photos: Photo[];
  timeline: { status: Status; label: string; at: string }[];
  created_at: string;
}

export interface AppJob extends AppRequest {
  client: { name: string; phone: string };
  phone: string;
  latitude: number | null;
  longitude: number | null;
  price: string;
}

export interface ClientMe {
  name: string;
  phone: string;
  address: string;
  kinds: { value: string; label: string }[];
  projects: { id: number; code: string; name: string; address: string; status: string }[];
  open: number;
}

export interface MasterMe {
  name: string;
  phone: string;
  code: string;
  region: string;
  active: number;
  new: number;
  done_month: number;
  rating: number | null;
  ratings: number;
}

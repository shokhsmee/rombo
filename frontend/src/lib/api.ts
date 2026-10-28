import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const ACCESS = "rombo.access";
const REFRESH = "rombo.refresh";

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS);
  },
  get refresh() {
    return localStorage.getItem(REFRESH);
  },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS, access);
    if (refresh) localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

export const api = axios.create({ baseURL: "/api/v1" });

api.interceptors.request.use((cfg) => {
  const t = tokens.access;
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccess(): Promise<string | null> {
  const refresh = tokens.refresh;
  if (!refresh) return null;
  try {
    const { data } = await axios.post("/api/v1/auth/refresh/", { refresh });
    tokens.set(data.access, data.refresh);
    return data.access;
  } catch {
    tokens.clear();
    return null;
  }
}

// On 401: refresh once (shared between parallel requests), retry, else log out.
api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retry && !original.url?.includes("/auth/login")) {
      original._retry = true;
      refreshing ??= refreshAccess().finally(() => (refreshing = null));
      const access = await refreshing;
      if (access) {
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
      }
      window.dispatchEvent(new Event("rombo:logout"));
    }
    return Promise.reject(error);
  },
);

export type ApiError = { code: string; message: string; field: string | null; fields: Record<string, string> };

export function apiError(e: unknown): ApiError {
  const data = (e as AxiosError<{ error?: ApiError }>)?.response?.data;
  if (data?.error) return data.error;
  return { code: "network", message: "Server bilan aloqa yo'q", field: null, fields: {} };
}

export type Page<T> = { items: T[]; total: number; page: number; size: number };

export type Ref = { id: number; code: string | null; name: string };

/** Drop empty values so the URL stays clean: {q: "", page: 1} -> {page: 1} */
export function cleanParams(p: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(p).filter(([, v]) => v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && !v.length)),
  );
}

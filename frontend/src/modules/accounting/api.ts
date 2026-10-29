import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, cleanParams, type Page, type Ref } from "@/lib/api";
import { crudResource } from "@/lib/crud";

export type Currency = "UZS" | "USD";
export type AccountKind = "asset" | "contra_asset" | "liability" | "equity" | "income" | "expense";
export const KIND_LABEL: Record<AccountKind, string> = {
  asset: "Aktiv", contra_asset: "Kontr-aktiv", liability: "Majburiyat", equity: "Kapital", income: "Daromad", expense: "Xarajat",
};

// ---- chart of accounts, roles, rates

export type Account = {
  id: number; code: string; name: string; kind: AccountKind; parent_id: number | null;
  is_active: boolean; allow_posting: boolean; has_lines: boolean; roles: string[]; updated_at: string;
};
export type AccountInput = Partial<Pick<Account, "code" | "name" | "kind" | "parent_id" | "is_active" | "allow_posting">>;
export type AccountRef = { id: number; code: string; name: string };
export type Role = { id: number; key: string; label: string; account: AccountRef };
export type Rate = { id: number; date: string; currency: Currency; rate: string; source: string; updated_at: string };

const ACCOUNTS = ["accounting", "accounts"];

export function useAccounts(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [...ACCOUNTS, params],
    queryFn: async () => (await api.get<Account[]>("/accounting/accounts/", { params: cleanParams(params) })).data,
    staleTime: 60_000,
  });
}

export function useAccountActions() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ACCOUNTS });
  return {
    save: useMutation({
      mutationFn: async ({ id, data }: { id?: number; data: AccountInput }) =>
        id ? (await api.patch<Account>(`/accounting/accounts/${id}/`, data)).data
          : (await api.post<Account>("/accounting/accounts/", data)).data,
      onSuccess: done,
    }),
    remove: useMutation({ mutationFn: async (id: number) => api.delete(`/accounting/accounts/${id}/`), onSuccess: done }),
  };
}

export function useRoles() {
  return useQuery({ queryKey: ["accounting", "roles"], queryFn: async () => (await api.get<Role[]>("/accounting/roles/")).data });
}

export function useSetRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, account_id }: { id: number; account_id: number }) =>
      (await api.patch<Role>(`/accounting/roles/${id}/`, { account_id })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounting", "roles"] }); qc.invalidateQueries({ queryKey: ACCOUNTS }); },
  });
}

export const ratesApi = crudResource<Rate, Rate, Partial<Pick<Rate, "date" | "currency" | "rate">>>("accounting/rates");

// ---- journal

export type SourceKind = "document" | "manual" | "reversal";
export type EntryStatus = "posted" | "reversed";
export type Line = {
  id: number; account: AccountRef; debit: string; credit: string; partner: Ref | null; project: Ref | null;
  currency: Currency; amount_cur: string | null; rate: string | null; memo: string;
};
export type EntryListItem = {
  id: number; code: string; date: string; memo: string; source_model: string; source_id: number | null; source_label: string;
  source_kind: SourceKind; status: EntryStatus; reversed_by_code: string | null; total_debit: string; posted_by: string; posted_at: string;
};
export type Entry = EntryListItem & { reversal_of_code: string | null; total_credit: string; lines: Line[] };
export type LineInput = {
  account_id: number; debit?: string; credit?: string; partner_id?: number | null; project_id?: number | null;
  currency?: Currency; amount_cur?: string | null; rate?: string | null; memo?: string;
};
export type ManualEntryInput = { date: string; memo: string; lines: LineInput[] };

export const entriesApi = crudResource<EntryListItem, Entry, ManualEntryInput>("accounting/entries");

export function useReverseEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: number; date?: string | null; memo?: string }) =>
      (await api.post<Entry>(`/accounting/entries/${id}/reverse/`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: entriesApi.keys.all }),
  });
}

// ---- invoices

export type InvoiceKind = "customer" | "supplier";
export type InvoiceStatus = "draft" | "confirmed" | "cancelled";
export type InvoiceLine = {
  id?: number; name: string; unit: string; qty: string; price: string; vat_rate: string | null; role: string;
  net?: string; vat?: string; gross?: string;
};
export type InvoiceListItem = {
  id: number; code: string; kind: InvoiceKind; status: InvoiceStatus; partner: Ref; project: Ref | null; date: string;
  external_number: string; external_date: string | null; currency: Currency; rate: string | null;
  net: string; vat: string; gross: string; entry_code: string | null; created_at: string;
};
export type Invoice = InvoiceListItem & {
  partner_id: number; project_id: number | null; notes: string; lines: Required<InvoiceLine>[]; entry_id: number | null; updated_at: string;
};
export type InvoiceInput = Partial<{
  kind: InvoiceKind; partner_id: number | null; project_id: number | null; date: string; external_number: string;
  external_date: string | null; currency: Currency; rate: string | null; notes: string;
  lines: { name: string; unit: string; qty: string; price: string; vat_rate: string | null; role: string }[];
}>;

export const invoicesApi = crudResource<InvoiceListItem, Invoice, InvoiceInput>("accounting/invoices");

export function useInvoiceActions(id: number) {
  const qc = useQueryClient();
  const done = (inv: Invoice) => {
    qc.setQueryData(invoicesApi.keys.detail(inv.id), inv);
    qc.invalidateQueries({ queryKey: invoicesApi.keys.all });
    qc.invalidateQueries({ queryKey: entriesApi.keys.all });
    qc.invalidateQueries({ queryKey: ["chatter", "accounting.invoice", inv.id] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  };
  return {
    confirm: useMutation({ mutationFn: async () => (await api.post<Invoice>(`/accounting/invoices/${id}/confirm/`, {})).data, onSuccess: done }),
    cancel: useMutation({
      mutationFn: async (date?: string) => (await api.post<Invoice>(`/accounting/invoices/${id}/cancel/`, date ? { date } : {})).data,
      onSuccess: done,
    }),
  };
}

/** "Hisob-faktura chiqarish" on the Loyiha: drafts a customer invoice from the order lines. */
export function useInvoiceFromProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: number) => (await api.post<Invoice>(`/projects/${projectId}/invoice/`, {})).data,
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: invoicesApi.keys.all });
      qc.invalidateQueries({ queryKey: ["chatter", "projects.project", inv.project?.id] });
    },
  });
}

// ---- reports and balances

export type TrialRow = {
  account: AccountRef & { kind: AccountKind };
  open_dt: string; open_kt: string; dt: string; kt: string; close_dt: string; close_kt: string;
};
export type TrialBalance = { from: string | null; to: string | null; rows: TrialRow[]; totals: Omit<TrialRow, "account"> };

export type EntryRef = { id: number; code: string; memo: string; source_kind: SourceKind; status: EntryStatus; source_model: string; source_id: number | null };
export type CardRow = {
  id: number; date: string; entry: EntryRef; memo: string; partner: { id: number; name: string } | null;
  project: { id: number; code: string; name: string } | null; debit: string; credit: string; currency: Currency;
  amount_cur: string | null; rate: string | null; balance: string;
};
export type AccountCard = {
  account: AccountRef & { kind: AccountKind }; from: string | null; to: string | null; opening: string; rows: CardRow[];
  turnover_dt: string; turnover_kt: string; closing: string;
};
export type ActRow = {
  date: string; entry: EntryRef; document: string; memo: string; dt: string; kt: string; currency: Currency; amount_cur: string; balance: string;
};
export type Reconciliation = {
  partner: { id: number; code: string | null; name: string; tin: string }; from: string | null; to: string | null;
  opening: string; rows: ActRow[]; turnover_dt: string; turnover_kt: string; closing: string;
};

function useReport<T>(path: string, params: Record<string, unknown>, enabled = true) {
  return useQuery({
    queryKey: ["accounting", "report", path, params],
    queryFn: async () => (await api.get<T>(`/accounting/reports/${path}/`, { params: cleanParams(params) })).data,
    enabled,
    placeholderData: keepPreviousData,
  });
}
export const useTrialBalance = (p: { from?: string; to?: string }) => useReport<TrialBalance>("trial-balance", p);
export const useAccountCard = (p: { account: number | null; from?: string; to?: string; partner?: number | null; project?: number | null }) =>
  useReport<AccountCard>("account-card", p, !!p.account);
export const useReconciliation = (p: { partner: number | null; from?: string; to?: string }) =>
  useReport<Reconciliation>("reconciliation", p, !!p.partner);

export type PartnerBalance = { ar: string; advance_received: string; ap: string; advance_paid: string; net_uzs: string; net_cur: Record<string, string> };
export function usePartnerBalance(partnerId: number | null | undefined) {
  return useQuery({
    queryKey: ["accounting", "balance", "partner", partnerId],
    queryFn: async () => (await api.get<PartnerBalance>(`/accounting/balances/partner/${partnerId}/`)).data,
    enabled: !!partnerId,
  });
}

export type ProjectMoney = { invoiced: string; paid: string; debt: string };

export function useInvoicesOf(params: Record<string, unknown>, enabled = true) {
  return useQuery({
    queryKey: invoicesApi.keys.list(params),
    queryFn: async () => (await api.get<Page<InvoiceListItem>>("/accounting/invoices/", { params: cleanParams(params) })).data,
    enabled,
  });
}

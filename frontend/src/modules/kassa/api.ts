import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, cleanParams, type Page, type Ref } from "@/lib/api";
import { crudResource } from "@/lib/crud";
import type { AccountRef, Currency } from "@/modules/accounting/api";

export type AccountKind = "cash" | "bank";
export type OrderKind = "in" | "out" | "transfer";
export type OrderStatus = "draft" | "posted" | "cancelled";
export type Direction = "in" | "out" | "both";
export type Posting = "partner_customer" | "partner_supplier" | "account";

// ---- accounts

export type CashAccount = {
  id: number; name: string; kind: AccountKind; currency: Currency; account: AccountRef; bank_name: string; mfo: string;
  account_number: string; responsible: Ref | null; cash_limit: string | null; is_active: boolean;
  balance: string; balance_uzs: string; has_orders: boolean; updated_at: string;
};
export type CashAccountInput = Partial<{
  name: string; kind: AccountKind; currency: Currency; account_id: number | null; bank_name: string; mfo: string;
  account_number: string; responsible_id: number | null; cash_limit: string | null; is_active: boolean;
}>;
export type CashAccountRef = { id: number; name: string; kind: AccountKind; currency: Currency; responsible: Ref | null };

const ACCOUNTS = ["kassa", "accounts"];

export function useCashAccounts(params: Record<string, unknown> = {}, enabled = true) {
  return useQuery({
    queryKey: [...ACCOUNTS, params],
    queryFn: async () => (await api.get<CashAccount[]>("/kassa/accounts/", { params: cleanParams(params) })).data,
    enabled,
  });
}

export function useCashAccountSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: number; data: CashAccountInput }) =>
      id ? (await api.patch<CashAccount>(`/kassa/accounts/${id}/`, data)).data
        : (await api.post<CashAccount>("/kassa/accounts/", data)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kassa"] }); qc.invalidateQueries({ queryKey: ["chatter"] }); },
  });
}

// ---- purposes

export type Purpose = {
  id: number; name: string; direction: Direction; posting: Posting; account_role: string;
  requires_partner: boolean; requires_employee: boolean; is_active: boolean; sort_order: number;
};
export type PurposeInput = Partial<Omit<Purpose, "id">>;

export function usePurposes() {
  return useQuery({
    queryKey: ["kassa", "purposes"],
    queryFn: async () => (await api.get<Purpose[]>("/kassa/purposes/")).data,
    staleTime: 60_000,
  });
}

export function usePurposeActions() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["kassa", "purposes"] });
  return {
    save: useMutation({
      mutationFn: async ({ id, data }: { id?: number; data: PurposeInput }) =>
        id ? (await api.patch<Purpose>(`/kassa/purposes/${id}/`, data)).data
          : (await api.post<Purpose>("/kassa/purposes/", data)).data,
      onSuccess: done,
    }),
    remove: useMutation({ mutationFn: async (id: number) => api.delete(`/kassa/purposes/${id}/`), onSuccess: done }),
  };
}

// ---- orders

export type PurposeRef = { id: number; name: string; posting: Posting };
export type CashOrderListItem = {
  id: number; code: string | null; kind: OrderKind; status: OrderStatus; date: string; account: CashAccountRef;
  to_account: CashAccountRef | null; amount: string; currency: Currency; rate: string | null; amount_uzs: string;
  purpose: PurposeRef | null; partner: Ref | null; project: Ref | null; employee: Ref | null; basis: string;
  entry_code: string | null; created_at: string;
};
export type CashOrder = CashOrderListItem & {
  account_id: number; to_account_id: number | null; purpose_id: number | null; account_role: string;
  partner_id: number | null; project_id: number | null; employee_id: number | null; invoice_id: number | null;
  invoice: { id: number; code: string; gross: string; currency: Currency } | null;
  payment_request_id: number | null; payment_request_code: string | null;
  received_from: string; issued_to: string; notes: string; entry_id: number | null; posted_at: string | null;
  posted_by: string; created_by: string; allowed_statuses: OrderStatus[]; updated_at: string;
};
export type CashOrderInput = Partial<{
  kind: OrderKind; date: string; account_id: number | null; to_account_id: number | null; amount: string;
  rate: string | null; purpose_id: number | null; account_role: string; partner_id: number | null;
  project_id: number | null; employee_id: number | null; invoice_id: number | null; basis: string;
  received_from: string; issued_to: string; notes: string; payment_request_id: number | null;
}>;

export const ordersApi = crudResource<CashOrderListItem, CashOrder, CashOrderInput>("kassa/orders");

export function useOrderActions(id: number) {
  const qc = useQueryClient();
  const done = (o: CashOrder) => {
    qc.setQueryData(ordersApi.keys.detail(o.id), o);
    qc.invalidateQueries({ queryKey: ["kassa"] });
    qc.invalidateQueries({ queryKey: ["accounting"] });
    qc.invalidateQueries({ queryKey: ["chatter"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: paymentRequestsApi.keys.all });
    qc.invalidateQueries({ queryKey: ["procurement/orders"] });
  };
  return {
    post: useMutation({ mutationFn: async () => (await api.post<CashOrder>(`/kassa/orders/${id}/post/`, {})).data, onSuccess: done }),
    cancel: useMutation({
      mutationFn: async (body: { comment: string; date?: string | null }) => (await api.post<CashOrder>(`/kassa/orders/${id}/cancel/`, body)).data,
      onSuccess: done,
    }),
  };
}

/** Orders of one Loyiha / partner — the smart buttons' counts. */
export function useOrdersOf(params: Record<string, unknown>, enabled = true) {
  return useQuery({
    queryKey: ordersApi.keys.list(params),
    queryFn: async () => (await api.get<Page<CashOrderListItem>>("/kassa/orders/", { params: cleanParams(params), paramsSerializer: { indexes: null } })).data,
    enabled,
  });
}

// ---- summary and cash book

export type Summary = {
  total_uzs: string; cash_uzs: string; bank_uzs: string; month_in: string; month_out: string; today_in: string; today_out: string;
  drafts: number; payment_requests: number; accounts: { id: number; name: string; kind: AccountKind; currency: Currency; balance: string; balance_uzs: string }[];
};
export function useKassaSummary(enabled = true) {
  return useQuery({ queryKey: ["kassa", "summary"], queryFn: async () => (await api.get<Summary>("/kassa/summary/")).data, enabled });
}

export type BookRow = {
  id: number; code: string; kind: OrderKind; partner: { id: number; name: string } | null;
  project: { id: number; code: string; name: string } | null; employee: { id: number; name: string } | null;
  purpose: string; basis: string; in: string; out: string;
};
export type CashBook = {
  account: { id: number; name: string; kind: AccountKind; currency: Currency; cash_limit: string | null; responsible: string };
  date: string; opening: string; rows: BookRow[]; total_in: string; total_out: string; other: string; closing: string; over_limit: boolean;
};
export function useCashBook(p: { account: number | null; date: string }) {
  return useQuery({
    queryKey: ["kassa", "book", p],
    queryFn: async () => (await api.get<CashBook>("/kassa/book/", { params: p })).data,
    enabled: !!p.account && !!p.date,
    placeholderData: keepPreviousData,
  });
}

// ---- money requests (pul so'rovlari, ADR 0009)

export type PaymentRequestStatus = "draft" | "submitted" | "approved" | "rejected" | "paid" | "cancelled";
export type PaymentRequestListItem = {
  id: number; code: string; status: PaymentRequestStatus; partner: Ref; project: Ref | null; amount: string;
  currency: Currency; rate: string | null; purpose: PurposeRef | null; basis: string; needed_by: string | null;
  requested_by: string; paid: string; source_model: string; source_id: number | null; source_label: string; created_at: string;
};
export type PaymentRequest = PaymentRequestListItem & {
  partner_id: number; project_id: number | null; purpose_id: number | null; notes: string; decided_by: string;
  decided_at: string | null; decision_comment: string; allowed_statuses: PaymentRequestStatus[];
  cash_orders: { id: number; code: string | null; status: OrderStatus; date: string; amount: string; currency: Currency }[];
  updated_at: string;
};
export type PaymentRequestInput = Partial<{
  partner_id: number | null; project_id: number | null; amount: string; currency: Currency; rate: string | null;
  purpose_id: number | null; basis: string; notes: string; needed_by: string | null;
}>;

export const paymentRequestsApi = crudResource<PaymentRequestListItem, PaymentRequest, PaymentRequestInput>("kassa/payment-requests");

function usePaymentRequestAction(id: number, name: "submit" | "approve" | "reject" | "cancel") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { comment?: string } = {}) =>
      (await api.post<PaymentRequest>(`/kassa/payment-requests/${id}/${name}/`, body)).data,
    onSuccess: (r) => {
      qc.setQueryData(paymentRequestsApi.keys.detail(r.id), r);
      qc.invalidateQueries({ queryKey: paymentRequestsApi.keys.all });
      qc.invalidateQueries({ queryKey: ["kassa", "summary"] });
      qc.invalidateQueries({ queryKey: ["procurement/orders"] });
      qc.invalidateQueries({ queryKey: ["chatter"] });
    },
  });
}

export function usePaymentRequestActions(id: number) {
  return {
    submit: usePaymentRequestAction(id, "submit"),
    approve: usePaymentRequestAction(id, "approve"),
    reject: usePaymentRequestAction(id, "reject"),
    cancel: usePaymentRequestAction(id, "cancel"),
  };
}

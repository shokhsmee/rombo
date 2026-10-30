import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Ref } from "@/lib/api";
import { crudResource } from "@/lib/crud";

export type Currency = "UZS" | "USD";
export type UserRef = { id: number; full_name: string };
export type DocRef = { id: number; code: string | null };

export type Totals = { net: string; vat: string; gross: string; net_uzs: string; vat_uzs: string; gross_uzs: string };

// ---- purchase requests (XS)

export type RequestStatus = "draft" | "submitted" | "approved" | "rejected" | "ordered" | "cancelled";

export type RequestLine = {
  id: number; item_id: number | null; name: string; unit: string; qty: string; note: string;
  ordered_qty: string; remaining_qty: string;
};
export type RequestListItem = {
  id: number; code: string; status: RequestStatus; project: Ref; requester: UserRef | null;
  needed_by: string | null; lines_count: number; created_at: string;
};
export type StepState = "done" | "current" | "pending" | "rejected";
export type RequestApproval = {
  id: number; step_id: number | null; step_name: string; decision: "approved" | "rejected"; user: UserRef | null;
  comment: string; created_at: string;
};
export type PurchaseRequest = RequestListItem & {
  project_id: number; project_status: string; notes: string; lines: RequestLine[];
  submitted_at: string | null; approved_at: string | null; approved_by: UserRef | null;
  approval_step: { id: number; name: string; role: string } | null; approvals: RequestApproval[];
  steps: { id: number; name: string; role: string; state: StepState }[]; can_approve: boolean;
  allowed_statuses: RequestStatus[]; updated_at: string;
};
export type RequestLineInput = { item_id?: number | null; name: string; unit: string; qty: string; note?: string };
export type RequestInput = Partial<{ project_id: number | null; needed_by: string | null; notes: string; lines: RequestLineInput[] }>;

export const requestsApi = crudResource<RequestListItem, PurchaseRequest, RequestInput>("procurement/requests");

// ---- purchase orders (XB)

export type OrderStatus = "draft" | "sent" | "partially_received" | "received" | "cancelled";
export type SentVia = "print" | "email" | "other";

export type OrderLine = {
  id: number; request_line_id: number | null; request_code: string | null; project: Ref | null; item_id: number | null;
  name: string; unit: string; qty: string; price: string; vat_rate: string; received_qty: string; remaining_qty: string;
  net: string; vat: string; gross: string;
};
export type OrderListItem = {
  id: number; code: string; status: OrderStatus; supplier: Ref; project: Ref | null; date: string;
  expected_date: string | null; currency: Currency; rate: string | null; sent_at: string | null; sent_via: SentVia | "";
  totals: Totals; created_at: string;
};
export type PurchaseOrder = OrderListItem & {
  supplier_id: number; supplier_email: string; supplier_balance: { balance_uzs: string; balance_cur: string | null };
  project_id: number | null; notes: string; lines: OrderLine[]; sent_by: UserRef | null; sent_to: string;
  receipts: DocRef[]; payment_request: MoneyState | null; allowed_statuses: OrderStatus[]; updated_at: string;
};
export type MoneyStatus = "draft" | "submitted" | "approved" | "rejected" | "paid" | "cancelled";
export type MoneyState = { id: number; code: string; status: MoneyStatus; amount: string; paid: string; currency: Currency };
export type OrderLineInput = {
  request_line_id?: number | null; item_id?: number | null; name: string; unit: string; qty: string;
  price: string | null; vat_rate: string | null;
};
export type OrderInput = Partial<{
  supplier_id: number | null; project_id: number | null; date: string; expected_date: string | null; currency: Currency;
  rate: string | null; notes: string; lines: OrderLineInput[];
}>;

export const ordersApi = crudResource<OrderListItem, PurchaseOrder, OrderInput>("procurement/orders");

// ---- goods receipts (KR)

export type ReceiptStatus = "draft" | "posted" | "cancelled";

export type ReceiptLine = {
  id: number; order_line_id: number; name: string; unit: string; project: Ref | null; ordered_qty: string;
  order_received_qty: string; qty: string; price: string; vat_rate: string; net: string; vat: string; gross: string;
};
export type ReceiptListItem = {
  id: number; code: string; status: ReceiptStatus; order: DocRef; supplier: Ref; date: string; storekeeper: UserRef | null;
  invoice_number: string; currency: Currency; totals: Totals; created_at: string;
};
export type GoodsReceipt = ReceiptListItem & {
  order_id: number; project: Ref | null; rate: string | null; invoice_date: string | null; invoice_total: string | null;
  notes: string; lines: ReceiptLine[]; posted_at: string | null; posted_by: UserRef | null; entry_id: number | null;
  allowed_statuses: ReceiptStatus[]; updated_at: string;
  warehouse: { id: number; name: string } | null; warehouse_id: number | null; stock_moves: number;
};
export type ReceiptInput = Partial<{
  order_id: number; date: string; warehouse_id: number | null; invoice_number: string; invoice_date: string | null; invoice_total: string | null;
  notes: string; lines: { order_line_id: number; qty: string }[];
}>;

export const receiptsApi = crudResource<ReceiptListItem, GoodsReceipt, ReceiptInput>("procurement/receipts");

// ---- suppliers (clients of kind supplier)

export type Supplier = {
  id: number; code: string; kind: "supplier"; name: string; tin: string; contact_person: string; phone: string;
  phone_extra: string; email: string; region: string; address: string; bank_account: string; bank_name: string;
  mfo: string; price_currency: Currency; prepay_percent: number | null; credit_days: number | null; notes: string;
  is_active: boolean; balance_uzs: string; balance_cur: string | null; orders_count: number; created_at: string;
  updated_at: string;
};
export type SupplierInput = Partial<Omit<Supplier, "id" | "code" | "kind" | "balance_uzs" | "balance_cur" | "orders_count" | "created_at" | "updated_at">>;

export const suppliersApi = crudResource<Supplier, Supplier, SupplierInput>("procurement/suppliers");

// ---- document actions

const chatter = (model: string, id: number) => ["chatter", model, id];

function useDocAction<T extends { id: number }, B = void>(resource: { keys: { all: readonly unknown[]; detail: (id: number) => readonly unknown[] } },
  model: string, url: (id: number, body: B) => string, extraKeys: readonly unknown[][] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: B }) => (await api.post<T>(url(id, body), body ?? {})).data,
    onSuccess: (doc) => {
      qc.setQueryData(resource.keys.detail(doc.id), doc);
      qc.invalidateQueries({ queryKey: resource.keys.all });
      qc.invalidateQueries({ queryKey: chatter(model, doc.id) });
      for (const k of extraKeys) qc.invalidateQueries({ queryKey: k });
    },
  });
}

const REQ = "procurement.purchaserequest";
const ORD = "procurement.purchaseorder";
const REC = "procurement.goodsreceipt";

export const useRequestActions = () => ({
  submit: useDocAction<PurchaseRequest>(requestsApi, REQ, (id) => `/procurement/requests/${id}/submit/`),
  approve: useDocAction<PurchaseRequest, { comment?: string }>(requestsApi, REQ, (id) => `/procurement/requests/${id}/approve/`),
  reject: useDocAction<PurchaseRequest, { comment: string }>(requestsApi, REQ, (id) => `/procurement/requests/${id}/reject/`),
  reopen: useDocAction<PurchaseRequest>(requestsApi, REQ, (id) => `/procurement/requests/${id}/reopen/`),
  cancel: useDocAction<PurchaseRequest, { comment?: string }>(requestsApi, REQ, (id) => `/procurement/requests/${id}/cancel/`),
  fromCalc: useDocAction<PurchaseRequest, { calc_id: number }>(requestsApi, REQ, (id) => `/procurement/requests/${id}/from-calc/`),
});

export const useOrderActions = () => ({
  send: useDocAction<PurchaseOrder, { via: SentVia; to?: string; note?: string }>(ordersApi, ORD, (id) => `/procurement/orders/${id}/send/`,
    [["projects"], ["procurement/requests"]]),
  cancel: useDocAction<PurchaseOrder, { comment?: string }>(ordersApi, ORD, (id) => `/procurement/orders/${id}/cancel/`,
    [["procurement/requests"], ["kassa/payment-requests"]]),
  requestMoney: useDocAction<PurchaseOrder, { amount?: string | null; note?: string }>(ordersApi, ORD,
    (id) => `/procurement/orders/${id}/request-money/`, [["kassa/payment-requests"], ["kassa", "summary"]]),
});

export const useReceiptActions = () => ({
  post: useDocAction<GoodsReceipt>(receiptsApi, REC, (id) => `/procurement/receipts/${id}/post/`,
    [["procurement/orders"], ["procurement/suppliers"], ["projects"]]),
  cancel: useDocAction<GoodsReceipt, { comment?: string }>(receiptsApi, REC, (id) => `/procurement/receipts/${id}/cancel/`,
    [["procurement/orders"], ["procurement/suppliers"], ["projects"]]),
});

export type FromRequestsLine = { request_line_id: number; supplier_id: number; qty?: string | null };

/** "Buyurtma yaratish": one draft order per supplier from approved request lines. */
export function useOrdersFromRequests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { lines: FromRequestsLine[]; expected_date?: string | null; notes?: string }) =>
      (await api.post<PurchaseOrder[]>("/procurement/orders/from-requests/", body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ordersApi.keys.all });
      qc.invalidateQueries({ queryKey: requestsApi.keys.all });
      qc.invalidateQueries({ queryKey: ["chatter"] });
    },
  });
}

export function useStatusSummary(resource: "requests" | "orders" | "receipts") {
  return useQuery({
    queryKey: [`procurement/${resource}`, "summary"],
    queryFn: async () => (await api.get<{ status: string; count: number }[]>(`/procurement/${resource}/summary/`)).data,
  });
}

/** "Xaridga yuborish" on the Loyiha card: a draft request with the lines of all its calculations. */
export function useRequestFromProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: number) =>
      (await api.post<PurchaseRequest>("/procurement/requests/from-project/", { project_id: projectId })).data,
    onSuccess: (req) => {
      qc.setQueryData(requestsApi.keys.detail(req.id), req);
      qc.invalidateQueries({ queryKey: requestsApi.keys.all });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

// ---- approval steps (Sozlamalar)

export type ApprovalStep = { id: number; sequence: number; name: string; role_id: number; role: Ref; is_active: boolean; updated_at: string };
export type ApprovalStepInput = Partial<{ sequence: number; name: string; role_id: number | null; is_active: boolean }>;

const STEPS = ["procurement/approval-steps"];

export function useApprovalSteps() {
  return useQuery({
    queryKey: STEPS,
    queryFn: async () => (await api.get<ApprovalStep[]>("/procurement/approval-steps/")).data,
  });
}

export function useApprovalStepActions() {
  const qc = useQueryClient();
  const done = () => { qc.invalidateQueries({ queryKey: STEPS }); qc.invalidateQueries({ queryKey: requestsApi.keys.all }); };
  return {
    save: useMutation({
      mutationFn: async ({ id, data }: { id?: number; data: ApprovalStepInput }) =>
        id ? (await api.patch<ApprovalStep>(`/procurement/approval-steps/${id}/`, data)).data
          : (await api.post<ApprovalStep>("/procurement/approval-steps/", data)).data,
      onSuccess: done,
    }),
    remove: useMutation({ mutationFn: async (id: number) => api.delete(`/procurement/approval-steps/${id}/`), onSuccess: done }),
  };
}

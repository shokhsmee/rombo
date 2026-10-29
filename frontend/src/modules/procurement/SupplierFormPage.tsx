import { ShoppingCart, Wallet } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { ActionBar, DeleteButton, FieldGrid, RecordNav, RecordPage, Row, SaveButtons, Sheet, SheetTitle } from "@/components/Record";
import { ActivePill } from "@/components/Status";
import { Input, Select, Smart, Textarea, Toggle } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { fmtMoney } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { REGIONS } from "@/modules/clients/api";

import { suppliersApi, type Currency, type Supplier } from "./api";

type Values = {
  name: string; tin: string; contact_person: string; phone: string; phone_extra: string; email: string; region: string;
  address: string; bank_account: string; bank_name: string; mfo: string; price_currency: Currency; prepay_percent: string;
  credit_days: string; notes: string; is_active: boolean;
};

const EMPTY: Values = {
  name: "", tin: "", contact_person: "", phone: "", phone_extra: "", email: "", region: "", address: "", bank_account: "",
  bank_name: "", mfo: "", price_currency: "USD", prepay_percent: "", credit_days: "", notes: "", is_active: true,
};

export function SupplierFormPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan("suppliers");
  const canOrders = useCan("purchase_orders");
  const detail = suppliersApi.useDetail(isNew ? undefined : id);
  const save = suppliersApi.useSave();
  const remove = suppliersApi.useRemove();
  const s = detail.data;
  const editable = isNew ? can.create : can.update;

  const form = useServerForm<Values, Supplier>({
    initial: EMPTY,
    record: s,
    toForm: (r) => ({
      name: r.name, tin: r.tin, contact_person: r.contact_person, phone: r.phone, phone_extra: r.phone_extra, email: r.email,
      region: r.region, address: r.address, bank_account: r.bank_account, bank_name: r.bank_name, mfo: r.mfo,
      price_currency: r.price_currency, prepay_percent: r.prepay_percent == null ? "" : String(r.prepay_percent),
      credit_days: r.credit_days == null ? "" : String(r.credit_days), notes: r.notes, is_active: r.is_active,
    }),
    validate: {
      name: (v) => (v.trim().length >= 2 ? null : "Kamida 2 ta belgi"),
      tin: (v) => (!v || /^\d{9,14}$/.test(v) ? null : "9–14 ta raqam"),
      prepay_percent: (v) => (!v || (Number(v) >= 0 && Number(v) <= 100) ? null : "0–100"),
    },
  });
  const v = form.values;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    const data = { ...v, prepay_percent: v.prepay_percent === "" ? null : Number(v.prepay_percent), credit_days: v.credit_days === "" ? null : Number(v.credit_days) };
    save.mutate({ id, data }, {
      onSuccess: (saved) => {
        notifyOk("Saqlandi");
        form.commit();
        if (isNew) navigate(`/procurement/suppliers/${saved.id}`, { replace: true });
      },
      onError: (err) => applyServerErrors(form, err),
    });
  };

  if (!isNew && !s) return null;
  const balance = s ? Number(s.balance_uzs) : 0;

  return (
    <form onSubmit={submit}>
      <RecordPage chatter={s ? { model: "clients.client", id: s.id } : null}>
        <RecordNav listTo="/procurement/suppliers" listLabel="Yetkazib beruvchilar" crumb={s?.code ?? "Yangi"} navKey="procurement/suppliers" id={s?.id} />
        <ActionBar right={s && <ActivePill active={s.is_active} />}>
          {editable && <SaveButtons dirty={form.dirty} saving={save.isPending} isNew={isNew} onReset={form.reset} />}
          {s && can.delete && !form.dirty && (
            <DeleteButton busy={remove.isPending}
              onConfirm={() => remove.mutate(s.id, { onSuccess: () => navigate("/procurement/suppliers"), onError: notifyError })} />
          )}
        </ActionBar>

        <Sheet>
          <SheetTitle eyebrow={s ? `Yetkazib beruvchi · ${s.code}` : "Yetkazib beruvchi"} title={isNew ? "Yangi yetkazib beruvchi" : s!.name}
            smart={s && (
              <>
                <Smart icon={<Wallet className={`size-4 ${balance > 0 ? "text-bad" : "text-ok"}`} />}
                  value={<span className={balance > 0 ? "text-bad" : balance < 0 ? "text-ok" : ""}>{fmtMoney(Math.abs(balance), "UZS")}</span>}
                  label={balance > 0 ? "Qarzimiz" : balance < 0 ? "Avans berilgan" : "Saldo"} />
                {canOrders.view && (
                  <Smart icon={<ShoppingCart className="size-4" />} value={s.orders_count} label="Buyurtmalar" onClick={() => navigate(`/procurement/orders?supplier=${s.id}`)} />
                )}
              </>
            )} />
          <fieldset disabled={!editable} className="grid gap-6">
            <FieldGrid>
              <Row label="Nomi" required error={form.errors.name}><Input {...form.text("name")} placeholder="AKFA Group" /></Row>
              <Row label="STIR" error={form.errors.tin}><Input inputMode="numeric" placeholder="9 ta raqam" {...form.text("tin")} /></Row>
              <Row label="Aloqa shaxsi"><Input {...form.text("contact_person")} /></Row>
              <Row label="Telefon"><Input placeholder="+998 __ ___ __ __" {...form.text("phone")} /></Row>
              <Row label="Qo'sh. telefon"><Input {...form.text("phone_extra")} /></Row>
              <Row label="Email" error={form.errors.email}><Input type="email" placeholder="Buyurtmalar shu manzilga yuboriladi" {...form.text("email")} /></Row>
              <Row label="Hudud">
                <Select {...form.text("region")}>
                  <option value="">—</option>
                  {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </Row>
              <Row label="Manzil"><Input {...form.text("address")} /></Row>
            </FieldGrid>
            <FieldGrid title="Bank rekvizitlari">
              <Row label="Hisob raqami"><Input className="font-mono" {...form.text("bank_account")} /></Row>
              <Row label="Bank"><Input {...form.text("bank_name")} /></Row>
              <Row label="MFO"><Input className="w-32 font-mono" {...form.text("mfo")} /></Row>
            </FieldGrid>
            <FieldGrid title="Shartlar">
              <Row label="Narx valyutasi">
                <Select className="w-32" value={v.price_currency} onChange={(e) => form.set("price_currency", e.target.value as Currency)}>
                  <option value="UZS">so'm</option>
                  <option value="USD">USD</option>
                </Select>
              </Row>
              <Row label="Oldindan to'lov, %" error={form.errors.prepay_percent}><Input inputMode="numeric" className="w-32 tabular" {...form.text("prepay_percent")} /></Row>
              <Row label="Kredit kunlari"><Input inputMode="numeric" className="w-32 tabular" {...form.text("credit_days")} /></Row>
              <Row label="Holat"><Toggle label="Faol" checked={v.is_active} disabled={!editable} onChange={(x) => form.set("is_active", x)} /></Row>
              <Row label="Izoh" wide><Textarea {...form.text("notes")} /></Row>
            </FieldGrid>
          </fieldset>
        </Sheet>
      </RecordPage>
    </form>
  );
}

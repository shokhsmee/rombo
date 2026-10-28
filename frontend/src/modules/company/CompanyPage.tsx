import { useCan } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { ActionBar, FieldGrid, Row, SaveButtons, Sheet } from "@/components/Record";
import { Input } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { notifyOk } from "@/lib/notify";

import { useCompany, useSaveCompany, type Company } from "./api";

type Values = Omit<Company, "updated_at" | "delivery_days" | "prepay_percent"> & { delivery_days: string; prepay_percent: string };

const EMPTY: Values = {
  name: "", legal_form: "", director: "", director_short: "", city: "", address: "", bank_account: "", bank_name: "",
  mfo: "", inn: "", phone: "", delivery_days: "25", prepay_percent: "50",
};

/** Sozlamalar → Kompaniya: the seller's requisites printed on every shartnoma. */
export function CompanyPage() {
  const can = useCan("company");
  const company = useCompany();
  const save = useSaveCompany();
  const form = useServerForm<Values, Company>({
    initial: EMPTY,
    record: company.data,
    toForm: (c) => ({ ...c, delivery_days: String(c.delivery_days), prepay_percent: String(c.prepay_percent) }),
    validate: { name: (v) => (v.trim() ? null : "Majburiy") },
  });
  const v = form.values;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    save.mutate({ ...v, delivery_days: Number(v.delivery_days), prepay_percent: Number(v.prepay_percent) }, {
      onSuccess: () => { notifyOk("Saqlandi"); form.commit(); },
      onError: (err) => applyServerErrors(form, err),
    });
  };

  return (
    <form onSubmit={submit} className="grid max-w-4xl gap-3">
      <PageHeader title="Kompaniya rekvizitlari" lede="Shartnomada «Sotuvchi» sifatida chiqadi." />
      <ActionBar>{can.update && <SaveButtons dirty={form.dirty} saving={save.isPending} onReset={form.reset} />}
        {!form.dirty && <span className="text-sm text-muted">O'zgartirsangiz, «Saqlash» paydo bo'ladi.</span>}
      </ActionBar>
      <Sheet>
        <fieldset disabled={!can.update} className="grid gap-6">
          <FieldGrid>
            <Row label="Nomi" required error={form.errors.name}><Input placeholder="Rombo Group" {...form.text("name")} /></Row>
            <Row label="Tashkiliy shakli"><Input placeholder="OK, MChJ…" {...form.text("legal_form")} /></Row>
            <Row label="Direktor"><Input {...form.text("director")} /></Row>
            <Row label="Direktor (qisqa)"><Input placeholder="Акмалов Р." {...form.text("director_short")} /></Row>
            <Row label="Shahar"><Input {...form.text("city")} /></Row>
            <Row label="Manzil"><Input {...form.text("address")} /></Row>
            <Row label="Telefon"><Input {...form.text("phone")} /></Row>
          </FieldGrid>
          <FieldGrid title="Bank">
            <Row label="Hisob raqami"><Input className="font-mono" {...form.text("bank_account")} /></Row>
            <Row label="Bank"><Input {...form.text("bank_name")} /></Row>
            <Row label="MFO"><Input className="font-mono" {...form.text("mfo")} /></Row>
            <Row label="STIR (INN)"><Input className="font-mono" {...form.text("inn")} /></Row>
          </FieldGrid>
          <FieldGrid title="Shartnoma shartlari">
            <Row label="Oldindan to'lov, %"><Input inputMode="numeric" {...form.text("prepay_percent")} /></Row>
            <Row label="Topshirish, bank kuni"><Input inputMode="numeric" {...form.text("delivery_days")} /></Row>
          </FieldGrid>
        </fieldset>
      </Sheet>
    </form>
  );
}

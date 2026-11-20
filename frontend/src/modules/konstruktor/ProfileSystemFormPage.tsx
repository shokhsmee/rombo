// Profil tizimi: the workshop's rules as numbers (each with a picture of what it means) and the map from
// what the engine counts to the price-list lines the hisob-kitob uses.
import { Plus, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { useCan } from "@/auth/AuthProvider";
import { ActionBar, DeleteButton, FieldGrid, RecordNav, RecordPage, Row, SaveButtons, Sheet, SheetTitle } from "@/components/Record";
import { ActivePill } from "@/components/Status";
import { Checkbox, IconButton, Input, Pill, Select, Textarea, Toggle } from "@/components/ui";
import { applyServerErrors, useServerForm } from "@/hooks/useServerForm";
import { toNum } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";
import { pricingApi } from "@/modules/pricing/api";
import { RefSelect } from "@/modules/references/RefSelect";

import { PARAMS, systemsApi, useRoles, type ParamKey, type ProfileSystem, type RoleUnit } from "./api";

type ItemRow = { role: string; price_list_item: number | null; factor: string; round_up: boolean };
type Values = Record<ParamKey, string> & {
  name: string; price_list_id: number | null; product_type_id: number | null; bar_length_mm: string; kerf_mm: string;
  trim_mm: string; junk_pct: string; default_glass_id: number | null; needs_check: boolean; is_active: boolean; notes: string;
  items: ItemRow[];
};

const EMPTY: Values = {
  name: "", price_list_id: null, product_type_id: null, bar_length_mm: "6500", kerf_mm: "5", trim_mm: "0", junk_pct: "3",
  frame_width: "60", mullion_width: "80", sash_width: "76", weld_allowance: "3", mullion_allowance: "6", sash_overlap: "8",
  glass_deduction_fixed: "10", glass_deduction_sash: "10", bead_allowance: "0",
  default_glass_id: null, needs_check: true, is_active: true, notes: "", items: [],
};

const PARAM_INFO: Record<ParamKey, { label: string; hint: string }> = {
  frame_width: { label: "Rom eni", hint: "Rom tashqi chetidan oyna ochig'igacha" },
  mullion_width: { label: "Impost eni", hint: "Har qo'shni katak yarmini yo'qotadi" },
  sash_width: { label: "Tabaqa eni", hint: "Tabaqa tashqi chetidan oynagacha" },
  weld_allowance: { label: "Payvand zaxirasi", hint: "Har payvand uchiga qo'shiladi (mexanik ulanishda 0)" },
  mullion_allowance: { label: "Impost zaxirasi", hint: "Impost kesimi = profillar orasidagi ochiq joy + shu" },
  sash_overlap: { label: "Tabaqa ustamasi", hint: "Tabaqa ochiqdan har tomonga shuncha katta" },
  glass_deduction_fixed: { label: "Oyna ayirmasi — qo'zg'almas", hint: "Ochiq joy − oyna (eni va bo'yi uchun)" },
  glass_deduction_sash: { label: "Oyna ayirmasi — tabaqada", hint: "Tabaqa ichki ochig'i − oyna" },
  bead_allowance: { label: "Shtapik zaxirasi", hint: "Shtapik kesimi = ochiq tomon + shu" },
};

const UNIT_LABEL: Record<RoleUnit, string> = { bars: "xlist (raskroy)", m: "m", m2: "m²", pcs: "dona" };

export function ProfileSystemFormPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const can = useCan("profile_systems");
  const detail = systemsApi.useDetail(isNew ? undefined : id);
  const save = systemsApi.useSave();
  const remove = systemsApi.useRemove();
  const roles = useRoles().data ?? [];
  const priceLists = pricingApi.useList({ size: 100, is_active: true }).data?.items ?? [];
  const sys = detail.data;
  const editable = isNew ? can.create : can.update;

  const form = useServerForm<Values, ProfileSystem>({
    initial: EMPTY,
    record: sys,
    toForm: (r) => ({
      ...Object.fromEntries(PARAMS.map((k) => [k, String(Number(r[k]))])) as Record<ParamKey, string>,
      name: r.name, price_list_id: r.price_list_id, product_type_id: r.product_type_id,
      bar_length_mm: String(Number(r.bar_length_mm)), kerf_mm: String(Number(r.kerf_mm)), trim_mm: String(Number(r.trim_mm)),
      junk_pct: String(Number(r.junk_pct)), default_glass_id: r.default_glass_id, needs_check: r.needs_check,
      is_active: r.is_active, notes: r.notes,
      items: r.items.map((i) => ({ role: i.role, price_list_item: i.price_list_item, factor: String(Number(i.factor)), round_up: i.round_up })),
    }),
    validate: {
      name: (v) => (v.trim().length >= 2 ? null : "Kamida 2 ta belgi"),
      price_list_id: (v) => (v ? null : "Narx ro'yxatini tanlang"),
      items: (rows) => (rows.some((r) => !r.role || !r.price_list_item || !(toNum(r.factor) >= 0)) ? "Har qatorda vazifa va narx qatorini tanlang" : null),
    },
  });
  const v = form.values;
  const plItems = pricingApi.useDetail(v.price_list_id ?? undefined).data?.items ?? [];
  const glassItems = plItems.filter((i) => /м2|m2|м кв/i.test(i.unit));
  const unitOf = (role: string) => roles.find((r) => r.value === role)?.unit ?? "pcs";
  const setRow = (i: number, patch: Partial<ItemRow>) => form.set("items", v.items.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    const num = (s: string) => String(toNum(s));
    const data = {
      ...v, ...Object.fromEntries(PARAMS.map((k) => [k, num(v[k])])),
      bar_length_mm: num(v.bar_length_mm), kerf_mm: num(v.kerf_mm), trim_mm: num(v.trim_mm), junk_pct: num(v.junk_pct),
      items: v.items.map((r) => ({ ...r, factor: num(r.factor) })),
    };
    save.mutate({ id, data }, {
      onSuccess: (saved) => { notifyOk("Saqlandi"); form.commit(); if (isNew) navigate(`/settings/profile-systems/${saved.id}`, { replace: true }); },
      onError: (err) => applyServerErrors(form, err),
    });
  };

  if (!isNew && !sys) return null;

  return (
    <form onSubmit={submit}>
      <RecordPage chatter={sys ? { model: "konstruktor.profilesystem", id: sys.id } : null}>
        <RecordNav listTo="/settings/profile-systems" listLabel="Profil tizimlari" crumb={sys?.name ?? "Yangi"} navKey="profile_systems" id={sys?.id} />
        <ActionBar right={sys && <div className="flex gap-2">{sys.needs_check ? <Pill tone="warn">Sex tasdiqlamagan</Pill> : <Pill tone="ok">Sex tasdiqlagan</Pill>}<ActivePill active={sys.is_active} /></div>}>
          {editable && <SaveButtons dirty={form.dirty} saving={save.isPending} isNew={isNew} onReset={form.reset} />}
          {sys && can.delete && !form.dirty && (
            <DeleteButton busy={remove.isPending} text="Tizim arxivga o'tadi. Konstruksiyalarda ishlatilgan bo'lsa, o'chirib bo'lmaydi — nofaol qiling."
              onConfirm={() => remove.mutate(sys.id, { onSuccess: () => navigate("/settings/profile-systems"), onError: notifyError })} />
          )}
        </ActionBar>
        <Sheet>
          <SheetTitle eyebrow="Profil tizimi" title={isNew ? "Yangi profil tizimi" : sys!.name} />
          <fieldset disabled={!editable} className="grid gap-6">
            <FieldGrid>
              <Row label="Nomi" required error={form.errors.name}><Input placeholder="Rombo Termo 65" {...form.text("name")} /></Row>
              <Row label="Narx ro'yxati" required error={form.errors.price_list_id}>
                <Select value={v.price_list_id ?? ""} onChange={(e) => form.set("price_list_id", Number(e.target.value) || null)}>
                  <option value="">—</option>
                  {priceLists.map((pl) => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                </Select>
              </Row>
              <Row label="Buyurtma turi"><RefSelect kind="product_type" value={v.product_type_id} onChange={(x) => form.set("product_type_id", x)} /></Row>
              <Row label="Asosiy oyna" error={form.errors.default_glass_id}>
                <Select value={v.default_glass_id ?? ""} onChange={(e) => form.set("default_glass_id", Number(e.target.value) || null)}>
                  <option value="">—</option>
                  {glassItems.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </Select>
              </Row>
              <Row label="Holat">
                <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
                  <Toggle label="Faol" checked={v.is_active} onChange={(x) => form.set("is_active", x)} />
                  <Toggle label="Sex hali tasdiqlamagan" checked={v.needs_check} onChange={(x) => form.set("needs_check", x)} />
                </div>
              </Row>
              <Row label="Izoh"><Textarea rows={1} {...form.text("notes")} /></Row>
            </FieldGrid>

            <FieldGrid title="Xlist va arra">
              <Row label="Xlist uzunligi" error={form.errors.bar_length_mm}><Mm {...form.text("bar_length_mm")} /></Row>
              <Row label="Arra qalinligi" error={form.errors.kerf_mm}><Mm {...form.text("kerf_mm")} /></Row>
              <Row label="Uch kesimi" error={form.errors.trim_mm}><Mm {...form.text("trim_mm")} hint="Har xlist uchidan tashlanadi" /></Row>
              <Row label="Chiqindi, %" error={form.errors.junk_pct}><Mm {...form.text("junk_pct")} unit="%" hint="Metrli mollarga (rezina) qo'shiladi" /></Row>
            </FieldGrid>

            <div className="grid gap-3">
              <p className="t-label border-b border-line pb-2">O'lchamlar va zaxiralar</p>
              <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
                <ParamsPicture />
                <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                  {PARAMS.map((k) => (
                    <label key={k} className="grid gap-1 text-sm">
                      <span className="font-medium">{PARAM_INFO[k].label}</span>
                      <Mm {...form.text(k)} />
                      <span className="text-xs text-muted">{PARAM_INFO[k].hint}</span>
                      {form.errors[k] && <span className="text-xs font-medium text-bad">{form.errors[k]}</span>}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <p className="t-label border-b border-line pb-2">Narx ro'yxati bilan bog'lash</p>
              <p className="text-xs text-muted">Konstruktor nimani sanaydi (chapda) va hisob-kitobning qaysi qatoriga yozadi (o'ngda). Profillar raskroydan keyin xlist soni bo'lib tushadi; qolganlari «soni × koeffitsient».</p>
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                      <th className="px-3 py-2.5 font-medium">Nima sanaladi</th>
                      <th className="px-3 py-2.5 font-medium">Hisob-kitob qatori</th>
                      <th className="w-28 px-3 py-2.5 text-right font-medium">Koeffitsient</th>
                      <th className="w-24 px-3 py-2.5 text-center font-medium">Butunga</th>
                      {editable && <th className="w-10" />}
                    </tr>
                  </thead>
                  <tbody>
                    {v.items.map((r, i) => {
                      const unit = unitOf(r.role);
                      return (
                        <tr key={i} className="border-b border-line last:border-0">
                          <td className="px-2 py-1.5">
                            <Select value={r.role} onChange={(e) => setRow(i, { role: e.target.value })}>
                              <option value="">—</option>
                              {(["bars", "m", "m2", "pcs"] as RoleUnit[]).map((u) => (
                                <optgroup key={u} label={UNIT_LABEL[u]}>
                                  {roles.filter((x) => x.unit === u).map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                                </optgroup>
                              ))}
                            </Select>
                          </td>
                          <td className="px-2 py-1.5">
                            <Select value={r.price_list_item ?? ""} onChange={(e) => setRow(i, { price_list_item: Number(e.target.value) || null })}>
                              <option value="">—</option>
                              {plItems.map((it) => <option key={it.id} value={it.id}>{it.name} · {it.unit} · {Number(it.price)}</option>)}
                            </Select>
                          </td>
                          <td className="px-2 py-1.5">
                            {unit === "bars" ? <span className="block pr-2 text-right text-xs text-muted">raskroy</span>
                              : <Input inputMode="decimal" className="text-right tabular" value={r.factor} onChange={(e) => setRow(i, { factor: e.target.value })} />}
                          </td>
                          <td className="px-2 text-center">
                            {unit !== "bars" && <Checkbox label="Butunga yaxlitlash" checked={r.round_up} onChange={editable ? (x) => setRow(i, { round_up: x }) : undefined} />}
                          </td>
                          {editable && (
                            <td className="px-1">
                              <IconButton label="O'chirish" className="hover:text-bad" onClick={() => form.set("items", v.items.filter((_, j) => j !== i))}><X className="size-4" /></IconButton>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {editable && (
                  <div className="border-t border-line bg-ground/60 px-3 py-2.5">
                    <button type="button" disabled={!v.price_list_id} onClick={() => form.set("items", [...v.items, { role: "", price_list_item: null, factor: "1", round_up: false }])}
                      className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline disabled:opacity-50">
                      <Plus className="size-4" /> Bog'lanish qo'shish
                    </button>
                  </div>
                )}
              </div>
              {form.errors.items && <p className="text-xs font-medium text-bad">{form.errors.items}</p>}
            </div>
          </fieldset>
        </Sheet>
      </RecordPage>
    </form>
  );
}

function Mm({ unit = "mm", hint, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { unit?: string; hint?: string; error?: string }) {
  return (
    <span className="grid gap-1">
      <span className="relative">
        <Input inputMode="decimal" className="pr-10 text-right tabular" {...rest} />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{unit}</span>
      </span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </span>
  );
}

/** A corner of a window with the measured widths named — what each number in the list means. */
function ParamsPicture() {
  return (
    <svg viewBox="0 0 260 230" className="w-full rounded-xl border border-line bg-ground/60" aria-label="O'lchamlar sxemasi">
      <rect x={10} y={10} width={240} height={210} className="fill-surface stroke-ink" strokeWidth={1.5} />
      <rect x={40} y={40} width={180} height={150} className="fill-ground stroke-line-strong" />
      <rect x={128} y={40} width={22} height={150} className="fill-surface stroke-line-strong" />
      <rect x={146} y={34} width={80} height={162} className="fill-surface stroke-ink" strokeWidth={1.2} />
      <rect x={166} y={54} width={40} height={122} className="fill-info-soft stroke-line-strong" />
      <rect x={48} y={48} width={72} height={134} className="fill-info-soft stroke-line-strong" />
      <g className="fill-muted" style={{ fontSize: 10 }}>
        <line x1={10} y1={200} x2={40} y2={200} className="stroke-accent" strokeWidth={1.5} />
        <text x={12} y={214} className="fill-accent-ink">rom eni</text>
        <line x1={128} y1={205} x2={150} y2={205} className="stroke-warn" strokeWidth={1.5} />
        <text x={112} y={218} className="fill-warn">impost eni</text>
        <line x1={146} y1={28} x2={166} y2={28} className="stroke-ok" strokeWidth={1.5} />
        <text x={160} y={22} className="fill-ok">tabaqa eni</text>
        <line x1={40} y1={30} x2={48} y2={30} className="stroke-info" strokeWidth={1.5} />
        <text x={14} y={26} className="fill-info">oyna ayirmasi</text>
        <text x={66} y={120} className="fill-info">oyna</text>
        <text x={176} y={120} className="fill-info">oyna</text>
        <text x={174} y={190} className="fill-ok">tabaqa</text>
      </g>
    </svg>
  );
}

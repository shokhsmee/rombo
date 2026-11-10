import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote, CalendarClock, ClipboardCheck, ClipboardList, MapPin, Navigation, Phone, ShieldCheck, Star, User,
} from "lucide-react";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { Route, Routes, useNavigate, useParams } from "react-router-dom";

import { type AppJob, appApi, type MasterMe, toError } from "../api";
import { alert, confirm, haptic, openLink, useBackButton } from "../tg";
import {
  Button, Card, cx, Empty, ErrorView, Field, fmtDate, inputCls, Loading, MainAction, PhotoGrid, PhotoPicker,
  prettyPhone, Row, SectionTitle, Screen, Stars, StatusBadge, Timeline,
} from "../ui";

const http = appApi("master");

export function MasterApp() {
  return (
    <Routes>
      <Route index element={<Home />} />
      <Route path="j/:id" element={<Job />} />
    </Routes>
  );
}

// ------------------------------------------------------------------ home

function Home() {
  useBackButton(null);
  const [scope, setScope] = useState<"active" | "history">("active");
  const me = useQuery({ queryKey: ["master", "me"], queryFn: async () => (await http.get<MasterMe>("/me/")).data });
  const jobs = useQuery({
    queryKey: ["master", "jobs", scope],
    queryFn: async () => (await http.get<AppJob[]>("/jobs/", { params: { scope } })).data,
    enabled: me.isSuccess,
  });
  if (me.isLoading) return <Loading />;
  if (me.error) return <ErrorView error={toError(me.error)} onRetry={() => me.refetch()} />;
  const m = me.data!;

  return (
    <Screen>
      <div className="px-1 pb-4 pt-2">
        <div className="text-sm text-hint">Usta · {m.code}</div>
        <div className="text-xl font-semibold">{m.name}</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat value={m.active} label="Faol ish" highlight={m.new > 0 ? `${m.new} yangi` : undefined} />
        <Stat value={m.done_month} label="Shu oy bajarildi" />
        <Stat value={m.rating ? m.rating.toFixed(1) : "—"} label={`Reyting${m.ratings ? ` (${m.ratings})` : ""}`}
          icon={<Star size={14} className="fill-star text-star" />} />
      </div>

      <div className="mt-5 grid grid-cols-2 rounded-xl bg-soft p-1 text-sm font-medium">
        {(["active", "history"] as const).map((s) => (
          <button key={s} type="button"
            onClick={() => { haptic.select(); setScope(s); }}
            className={cx("rounded-lg py-2 transition-colors", scope === s ? "bg-card text-ink shadow-sm" : "text-hint")}>
            {s === "active" ? "Faol ishlar" : "Tarix"}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {jobs.isLoading ? <Loading /> : jobs.data?.length ? jobs.data.map((j) => <JobCard key={j.id} j={j} />) : (
          <Empty icon={<ClipboardList size={40} strokeWidth={1.25} />}
            title={scope === "active" ? "Faol ish yo'q" : "Tarix bo'sh"}
            hint={scope === "active" ? "Yangi ish berilganda botga xabar keladi." : undefined} />
        )}
      </div>
    </Screen>
  );
}

function Stat({ value, label, highlight, icon }: { value: number | string; label: string; highlight?: string;
  icon?: ReactNode }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1 text-xl font-semibold">{icon}{value}</div>
      <div className="text-xs leading-tight text-hint">{label}</div>
      {highlight && <div className="mt-1 text-xs font-medium text-warn">{highlight}</div>}
    </Card>
  );
}

function JobCard({ j }: { j: AppJob }) {
  const nav = useNavigate();
  return (
    <Card onClick={() => nav(`j/${j.id}`)}>
      <div className="flex items-center justify-between gap-2">
        <div className="truncate font-medium">{j.kind_label}</div>
        <StatusBadge status={j.status} label={j.status_label} />
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-sm text-hint">
        <MapPin size={14} className="shrink-0" /><span className="truncate">{j.address || "Manzil yo'q"}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-hint">
        <span>{j.code} · {j.client.name}</span>
        <span className={cx(j.scheduled_at && "font-medium text-ink")}>
          {j.scheduled_at ? fmtDate(j.scheduled_at) : j.preferred_date ? `~${fmtDate(j.preferred_date, false)}` : ""}
        </span>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ job

function mapsUrl(j: AppJob) {
  if (j.latitude != null && j.longitude != null)
    return `https://www.google.com/maps/search/?api=1&query=${j.latitude},${j.longitude}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.address)}`;
}

function Job() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const back = useCallback(() => nav("/master", { replace: true }), [nav]);
  useBackButton(back);
  const key = ["master", "job", id];
  const q = useQuery({ queryKey: key, queryFn: async () => (await http.get<AppJob>(`/jobs/${id}/`)).data });

  const [report, setReport] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [reportError, setReportError] = useState("");

  const act = useMutation({
    mutationFn: async ({ op, body }: { op: string; body?: object | FormData }) =>
      (await http.post(`/jobs/${id}/${op}/`, body ?? {})).data,
    onSuccess: (data, { op }) => {
      haptic.ok();
      qc.invalidateQueries({ queryKey: ["master"] });
      if (op === "decline") nav("/master", { replace: true });
      else qc.setQueryData(key, data);
    },
    onError: (e) => {
      haptic.error();
      alert(toError(e).message);
    },
  });

  const j = q.data;
  const before = useMemo(() => j?.photos.filter((p) => p.stage === "before") ?? [], [j]);
  const after = useMemo(() => j?.photos.filter((p) => p.stage === "after") ?? [], [j]);

  if (q.isLoading) return <Loading />;
  if (q.error || !j) return <ErrorView error={toError(q.error)} onRetry={() => q.refetch()} />;

  const finish = () => {
    if (!report.trim()) {
      haptic.error();
      setReportError("Nima qilinganini yozing");
      return;
    }
    const fd = new FormData();
    fd.append("report", report.trim());
    photos.forEach((f) => fd.append("photos", f));
    act.mutate({ op: "finish", body: fd });
  };

  const decline = async () => {
    if (!(await confirm("Bu ishni rad etasizmi? Ofis boshqa ustaga beradi."))) return;
    act.mutate({ op: "decline" });
  };

  const main = {
    assigned: { text: "✅ Ishni qabul qilish", run: () => act.mutate({ op: "accept" }) },
    accepted: { text: "🔧 Ishni boshlash", run: () => act.mutate({ op: "start" }) },
    in_progress: { text: "Ish tugadi", run: finish },
  }[j.status as "assigned" | "accepted" | "in_progress"];

  return (
    <Screen>
      <div className="flex items-start justify-between gap-3 px-1 pb-3 pt-2">
        <div>
          <div className="text-xs text-hint">{j.code}</div>
          <h1 className="text-xl font-semibold">{j.kind_label}</h1>
        </div>
        <StatusBadge status={j.status} label={j.status_label} />
      </div>

      <Card className="divide-y divide-line py-1.5">
        <Row icon={<User size={18} />}>{j.client.name}</Row>
        <Row icon={<Phone size={18} />} href={`tel:${j.phone || j.client.phone}`}>
          {prettyPhone(j.phone || j.client.phone)}
        </Row>
        <Row icon={<MapPin size={18} />}>{j.address || "Manzil ko'rsatilmagan"}</Row>
        {(j.address || j.latitude != null) && (
          <Row icon={<Navigation size={18} />} onClick={() => openLink(mapsUrl(j))}>Xaritada ochish</Row>
        )}
        <Row icon={<CalendarClock size={18} />}>
          {j.scheduled_at ? fmtDate(j.scheduled_at)
            : j.preferred_date ? `Mijozga qulay: ${fmtDate(j.preferred_date, false)}` : "Vaqt kelishiladi"}
        </Row>
        {j.is_warranty ? <Row icon={<ShieldCheck size={18} />}>Kafolat — mijozdan pul olinmaydi</Row>
          : Number(j.price) > 0 ? <Row icon={<Banknote size={18} />}>{Number(j.price).toLocaleString("ru-RU")} so'm</Row>
          : null}
        {j.project && <Row icon={<ClipboardList size={18} />}>{j.project.code} · {j.project.name}</Row>}
      </Card>

      <SectionTitle>Muammo</SectionTitle>
      <Card><p className="whitespace-pre-wrap text-[15px]">{j.description}</p></Card>
      {before.length > 0 && <div className="mt-2"><PhotoGrid photos={before} /></div>}

      {j.status === "in_progress" && (
        <>
          <SectionTitle>Hisobot</SectionTitle>
          <div className="space-y-3">
            <Field label="Nima qilindi" error={reportError}>
              <textarea rows={4} value={report} onChange={(e) => { setReport(e.target.value); setReportError(""); }}
                placeholder="Masalan: petlyalar rostlandi, ruchka almashtirildi" className={inputCls} />
            </Field>
            <Field label="Bajarilgan ish rasmlari">
              <PhotoPicker files={photos} onChange={setPhotos} />
            </Field>
          </div>
        </>
      )}

      {(j.status === "done" || j.status === "closed") && (
        <>
          <SectionTitle>Hisobot</SectionTitle>
          <Card>
            <div className="flex items-start gap-2">
              <ClipboardCheck size={18} className="mt-0.5 shrink-0 text-ok" />
              <p className="whitespace-pre-wrap text-[15px]">{j.report}</p>
            </div>
            {j.rating && (
              <div className="mt-3 border-t border-line pt-3">
                <div className="text-xs text-hint">Mijoz bahosi</div>
                <Stars value={j.rating} size={20} />
                {j.feedback && <p className="mt-1 text-sm">«{j.feedback}»</p>}
              </div>
            )}
          </Card>
          {after.length > 0 && <div className="mt-2"><PhotoGrid photos={after} /></div>}
        </>
      )}

      <SectionTitle>Holat tarixi</SectionTitle>
      <Card><Timeline steps={j.timeline} /></Card>

      {(j.status === "assigned" || j.status === "accepted") && (
        <Button variant="danger" className="mt-5 w-full" disabled={act.isPending} onClick={decline}>
          Rad etish
        </Button>
      )}

      <MainAction text={main?.text ?? ""} visible={Boolean(main)} busy={act.isPending}
        onClick={() => main?.run()} />
    </Screen>
  );
}

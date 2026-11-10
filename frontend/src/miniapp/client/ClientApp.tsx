import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays, ChevronRight, ClipboardList, Hammer, KeyRound, LocateFixed, MapPin, PanelTop, Phone, Plus,
  ShieldCheck, Sparkles, SquareDashed, Wind, Wrench,
} from "lucide-react";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { Route, Routes, useNavigate, useParams } from "react-router-dom";

import { type AppRequest, appApi, type ClientMe, toError } from "../api";
import { alert, confirm, haptic, useBackButton } from "../tg";
import {
  Button, Card, cx, Empty, ErrorView, Field, fmtDate, inputCls, Loading, MainAction, PhotoGrid, PhotoPicker,
  prettyPhone, Row, SectionTitle, Screen, Stars, StatusBadge, Timeline,
} from "../ui";

const http = appApi("client");

const KIND_ICON: Record<string, ReactNode> = {
  adjust: <Wrench size={22} strokeWidth={1.75} />,
  hardware: <KeyRound size={22} strokeWidth={1.75} />,
  glass: <PanelTop size={22} strokeWidth={1.75} />,
  net: <SquareDashed size={22} strokeWidth={1.75} />,
  seal: <Wind size={22} strokeWidth={1.75} />,
  install: <Hammer size={22} strokeWidth={1.75} />,
  other: <Sparkles size={22} strokeWidth={1.75} />,
};

function useMe() {
  return useQuery({ queryKey: ["client", "me"], queryFn: async () => (await http.get<ClientMe>("/me/")).data });
}

export function ClientApp() {
  return (
    <Routes>
      <Route index element={<Home />} />
      <Route path="new" element={<NewRequest />} />
      <Route path="r/:id" element={<Detail />} />
    </Routes>
  );
}

// ------------------------------------------------------------------ home

function Home() {
  const nav = useNavigate();
  useBackButton(null);
  const me = useMe();
  const list = useQuery({
    queryKey: ["client", "requests"],
    queryFn: async () => (await http.get<AppRequest[]>("/requests/")).data,
    enabled: me.isSuccess,
  });
  if (me.isLoading) return <Loading />;
  if (me.error) return <ErrorView error={toError(me.error)} onRetry={() => me.refetch()} />;

  const open = (list.data ?? []).filter((r) => !["closed", "cancelled"].includes(r.status));
  const past = (list.data ?? []).filter((r) => ["closed", "cancelled"].includes(r.status));
  return (
    <Screen>
      <div className="px-1 pb-4 pt-2">
        <div className="text-sm text-hint">Assalomu alaykum,</div>
        <div className="text-xl font-semibold">{me.data!.name}</div>
      </div>

      <button type="button" onClick={() => { haptic.tap(); nav("new"); }}
        className="flex w-full items-center gap-4 rounded-2xl bg-accent p-4 text-left text-on-accent transition-transform active:scale-[0.99]">
        <div className="rounded-xl bg-on-accent/20 p-2.5"><Plus size={24} /></div>
        <div className="flex-1">
          <div className="font-semibold">Yangi ariza</div>
          <div className="text-sm opacity-85">Deraza yoki eshikda muammo bormi? Usta yuboramiz</div>
        </div>
        <ChevronRight size={20} className="opacity-80" />
      </button>

      {list.isLoading ? <Loading /> : (
        <>
          {open.length > 0 && <SectionTitle>Faol arizalar</SectionTitle>}
          <div className="space-y-2">{open.map((r) => <RequestCard key={r.id} r={r} />)}</div>
          {past.length > 0 && <SectionTitle>Tarix</SectionTitle>}
          <div className="space-y-2">{past.map((r) => <RequestCard key={r.id} r={r} />)}</div>
          {!list.data?.length && (
            <Empty icon={<ClipboardList size={40} strokeWidth={1.25} />} title="Hali ariza yo'q"
              hint="Muammo bo'lsa — yuqoridagi tugma orqali ariza qoldiring. Holatini shu yerda kuzatasiz." />
          )}
        </>
      )}
    </Screen>
  );
}

function RequestCard({ r }: { r: AppRequest }) {
  const nav = useNavigate();
  return (
    <Card onClick={() => nav(`r/${r.id}`)} className="flex items-start gap-3">
      <div className="rounded-xl bg-accent-soft p-2.5 text-link">{KIND_ICON[r.kind] ?? KIND_ICON.other}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate font-medium">{r.kind_label}</div>
          <StatusBadge status={r.status} label={r.status_label} />
        </div>
        <div className="mt-0.5 line-clamp-2 text-sm text-hint">{r.description}</div>
        <div className="mt-1.5 text-xs text-hint">
          {r.code} · {fmtDate(r.created_at, false)}
          {r.master && ` · ${r.master.name}`}
        </div>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ new request

function NewRequest() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const back = useCallback(() => nav(-1), [nav]);
  useBackButton(back);
  const me = useMe();

  const [kind, setKind] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<number | "">("");
  const [address, setAddress] = useState<string | null>(null);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [date, setDate] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const project = me.data?.projects.find((p) => p.id === projectId);
  const shownAddress = address ?? (project?.address || me.data?.address || "");

  const send = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("kind", kind || "other");
      fd.append("description", description.trim());
      fd.append("address", shownAddress.trim());
      if (projectId) fd.append("project_id", String(projectId));
      if (point) {
        fd.append("latitude", String(point.lat));
        fd.append("longitude", String(point.lng));
      }
      if (date) fd.append("preferred_date", date);
      photos.forEach((f) => fd.append("photos", f));
      return (await http.post<AppRequest>("/requests/", fd)).data;
    },
    onSuccess: (r) => {
      haptic.ok();
      qc.invalidateQueries({ queryKey: ["client"] });
      nav(`/client/r/${r.id}`, { replace: true });
    },
    onError: (e) => {
      haptic.error();
      const err = toError(e);
      if (err.field) setErrors({ [err.field]: err.message });
      else alert(err.message);
    },
  });

  const submit = () => {
    if (!description.trim()) {
      haptic.error();
      setErrors({ description: "Muammoni qisqacha yozing" });
      return;
    }
    send.mutate();
  };

  const locate = () => {
    if (!navigator.geolocation) return alert("Qurilmangiz joylashuvni bermaydi");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        haptic.ok();
      },
      () => {
        setLocating(false);
        alert("Joylashuvni olib bo'lmadi. Telegram va telefon sozlamalarida ruxsat bering.");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  if (me.isLoading) return <Loading />;
  if (me.error) return <ErrorView error={toError(me.error)} />;

  return (
    <Screen>
      <h1 className="px-1 pb-1 pt-2 text-xl font-semibold">Yangi ariza</h1>
      <p className="px-1 pb-2 text-sm text-hint">Muammoni tanlang va qisqacha yozing — usta biriktirib, xabar beramiz.</p>

      <SectionTitle>Muammo turi</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {me.data!.kinds.map((k) => (
          <button key={k.value} type="button"
            onClick={() => { haptic.select(); setKind(k.value); }}
            className={cx("flex items-center gap-2.5 rounded-xl bg-card px-3 py-3 text-left text-sm ring-1 transition-colors",
              kind === k.value ? "ring-2 ring-accent text-link" : "ring-line")}>
            <span className={kind === k.value ? "text-link" : "text-hint"}>{KIND_ICON[k.value] ?? KIND_ICON.other}</span>
            <span className="leading-tight">{k.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        <Field label="Nima bo'ldi?" error={errors.description}>
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Masalan: yotoqxonadagi deraza yopilmayapti, ruchka qattiq" className={inputCls} />
        </Field>

        {me.data!.projects.length > 0 && (
          <Field label="Qaysi buyurtma (ixtiyoriy)" error={errors.project_id}>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : "")}
              className={inputCls}>
              <option value="">— Tanlanmagan —</option>
              {me.data!.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Manzil" error={errors.address}>
          <input value={shownAddress} onChange={(e) => setAddress(e.target.value)}
            placeholder="Shahar, ko'cha, uy, xonadon" className={inputCls} />
        </Field>
        <Button variant="soft" className="w-full" onClick={locate} disabled={locating}>
          <LocateFixed size={18} /> {point ? "Joylashuv olindi ✓" : locating ? "Aniqlanmoqda…" : "Joylashuvimni yuborish"}
        </Button>

        <Field label="Qachon kelsa qulay (ixtiyoriy)">
          <input type="date" value={date} min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>

        <Field label="Rasmlar (ixtiyoriy)" error={errors.photos}>
          <PhotoPicker files={photos} onChange={setPhotos} />
        </Field>
      </div>

      <MainAction text="Arizani yuborish" onClick={submit} busy={send.isPending} />
    </Screen>
  );
}

// ------------------------------------------------------------------ detail

function Detail() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const back = useCallback(() => nav("/client", { replace: true }), [nav]);
  useBackButton(back);
  const key = ["client", "request", id];
  const q = useQuery({ queryKey: key, queryFn: async () => (await http.get<AppRequest>(`/requests/${id}/`)).data });

  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [reopening, setReopening] = useState(false);
  const [comment, setComment] = useState("");

  const act = useMutation({
    mutationFn: async ({ op, body }: { op: string; body?: object }) =>
      (await http.post<AppRequest>(`/requests/${id}/${op}/`, body ?? {})).data,
    onSuccess: (r) => {
      haptic.ok();
      qc.setQueryData(key, r);
      qc.invalidateQueries({ queryKey: ["client", "requests"] });
      setReopening(false);
    },
    onError: (e) => {
      haptic.error();
      alert(toError(e).message);
    },
  });

  const r = q.data;
  const before = useMemo(() => r?.photos.filter((p) => p.stage === "before") ?? [], [r]);
  const after = useMemo(() => r?.photos.filter((p) => p.stage === "after") ?? [], [r]);

  if (q.isLoading) return <Loading />;
  if (q.error || !r) return <ErrorView error={toError(q.error)} onRetry={() => q.refetch()} />;

  const canCancel = ["new", "assigned", "accepted"].includes(r.status);
  const isDone = r.status === "done";

  return (
    <Screen>
      <div className="flex items-start justify-between gap-3 px-1 pb-3 pt-2">
        <div>
          <div className="text-xs text-hint">{r.code} · {fmtDate(r.created_at)}</div>
          <h1 className="text-xl font-semibold">{r.kind_label}</h1>
        </div>
        <StatusBadge status={r.status} label={r.status_label} />
      </div>

      {r.master && (
        <Card className="mb-3 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-link">
            <Wrench size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-hint">Usta</div>
            <div className="truncate font-medium">{r.master.name}</div>
            <div className="text-xs text-hint">{prettyPhone(r.master.phone)}</div>
            {r.scheduled_at && <div className="text-xs text-hint">Keladi: {fmtDate(r.scheduled_at)}</div>}
          </div>
          <a href={`tel:${r.master.phone}`} aria-label="Qo'ng'iroq"
            className="rounded-full bg-accent p-3 text-on-accent active:opacity-80">
            <Phone size={18} />
          </a>
        </Card>
      )}

      {isDone && !reopening && (
        <Card className="mb-3">
          <div className="font-medium">Ish bajarildi — baholang</div>
          {r.report && <p className="mt-1 text-sm text-hint">{r.report}</p>}
          <div className="mt-3"><Stars value={rating} onChange={setRating} /></div>
          <textarea rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)}
            placeholder="Izoh (ixtiyoriy)" className={cx(inputCls, "mt-3")} />
          <button type="button" onClick={() => setReopening(true)} className="mt-3 text-sm text-danger">
            Muammo hal bo'lmadimi?
          </button>
        </Card>
      )}

      {reopening && (
        <Card className="mb-3">
          <div className="font-medium">Nima hal bo'lmadi?</div>
          <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} autoFocus
            placeholder="Usta qaytib keladi" className={cx(inputCls, "mt-2")} />
          <div className="mt-3 flex gap-2">
            <Button variant="soft" className="flex-1" onClick={() => setReopening(false)}>Ortga</Button>
            <Button variant="danger" className="flex-1" disabled={!comment.trim() || act.isPending}
              onClick={() => act.mutate({ op: "reopen", body: { comment } })}>Yuborish</Button>
          </div>
        </Card>
      )}

      {r.status === "closed" && r.rating && (
        <Card className="mb-3">
          <div className="text-xs text-hint">Sizning bahoyingiz</div>
          <div className="mt-1"><Stars value={r.rating} size={22} /></div>
          {r.feedback && <p className="mt-2 text-sm">{r.feedback}</p>}
        </Card>
      )}

      <Card>
        <p className="whitespace-pre-wrap text-[15px]">{r.description}</p>
        <div className="mt-2 divide-y divide-line">
          {r.address && <Row icon={<MapPin size={18} />}>{r.address}</Row>}
          {r.preferred_date && <Row icon={<CalendarDays size={18} />}>Qulay sana: {fmtDate(r.preferred_date, false)}</Row>}
          {r.project && <Row icon={<ClipboardList size={18} />}>{r.project.code} · {r.project.name}</Row>}
          {r.is_warranty && <Row icon={<ShieldCheck size={18} />}>Kafolat bo'yicha</Row>}
        </div>
      </Card>

      {before.length > 0 && <><SectionTitle>Rasmlar</SectionTitle><PhotoGrid photos={before} /></>}
      {after.length > 0 && <><SectionTitle>Bajarilgan ish</SectionTitle><PhotoGrid photos={after} /></>}

      <SectionTitle>Holat tarixi</SectionTitle>
      <Card><Timeline steps={r.timeline} /></Card>

      {canCancel && (
        <Button variant="danger" className="mt-5 w-full" disabled={act.isPending}
          onClick={async () => {
            if (await confirm("Arizani bekor qilasizmi?")) act.mutate({ op: "cancel" });
          }}>
          Arizani bekor qilish
        </Button>
      )}
      <div className="mt-4 text-center text-xs text-hint">Savol bo'lsa: botga yozing yoki ofisga qo'ng'iroq qiling</div>

      <MainAction text="Tasdiqlash va baholash" visible={isDone && !reopening} disabled={!rating}
        busy={act.isPending} onClick={() => act.mutate({ op: "rate", body: { rating, feedback } })} />
    </Screen>
  );
}

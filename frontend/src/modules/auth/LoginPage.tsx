import {
  ArrowRight, Calculator, Eye, EyeOff, Factory, FileText, Lock, ShoppingCart, User, Wallet, Warehouse,
} from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/AuthProvider";
import { BrandMark } from "@/components/Brand";
import { Logo } from "@/components/Shell";
import { Button, ErrorNote, Field, Input } from "@/components/ui";
import { apiError } from "@/lib/api";

// The order flow the ERP covers, left to right — the showcase panel draws it as one chain.
const FLOW = [
  [FileText, "Loyiha", "Buyurtma va shartnoma"],
  [ShoppingCart, "Xarid", "Profil, oyna, furnitura"],
  [Warehouse, "Ombor", "Kirim, chiqim, qoldiq"],
  [Factory, "Ishlab chiqarish", "Material va kamomad"],
  [Wallet, "Kassa", "To'lov va avans"],
  [Calculator, "Buxgalteriya", "NSBU hisob-kitob"],
] as const;

export function LoginPage() {
  const { me, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (me) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return setError("Login va parolni kiriting");
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      navigate((location.state as { from?: string })?.from ?? "/", { replace: true });
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState("CapsLock"));

  return (
    <div className="grid min-h-full bg-ground lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Form side */}
      <div className="relative grid place-items-center overflow-hidden px-4 py-12 sm:px-6">
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 size-[520px] -translate-x-1/2 rounded-full opacity-60 blur-3xl lg:hidden"
          style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--color-accent) 22%, transparent), transparent 70%)" }} />

        <form onSubmit={submit} noValidate
          className="anim-pop relative grid w-full max-w-[400px] gap-6 rounded-2xl border border-line bg-surface p-6 shadow-pop sm:p-8">
          <Logo tagline />

          <div className="grid gap-1.5">
            <h1 className="t-title">Xush kelibsiz</h1>
            <p className="text-muted">Ish hisobingiz bilan tizimga kiring.</p>
          </div>

          <ErrorNote error={error} />

          <div className="grid gap-4">
            <Field label="Login">
              <div className="relative">
                <User strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
                <Input autoFocus autoComplete="username" placeholder="Login" className="h-11 pl-10" value={username}
                  onChange={(e) => setUsername(e.target.value)} />
              </div>
            </Field>

            <Field label="Parol" error={caps ? "Caps Lock yoqilgan" : undefined}>
              <div className="relative">
                <Lock strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
                <Input type={show ? "text" : "password"} autoComplete="current-password" placeholder="Parol"
                  className="h-11 pl-10 pr-11" value={password} onKeyUp={onKey} onKeyDown={onKey}
                  onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Parolni yashirish" : "Parolni ko'rsatish"} aria-pressed={show}
                  className="press absolute inset-y-1 right-1 grid w-9 place-items-center rounded-md text-muted hover:bg-sunk hover:text-ink">
                  {show ? <EyeOff strokeWidth={1.75} className="size-4" /> : <Eye strokeWidth={1.75} className="size-4" />}
                </button>
              </div>
            </Field>
          </div>

          <Button type="submit" busy={busy} className="group h-11 text-[15px]">
            Kirish
            {!busy && <ArrowRight strokeWidth={1.75} className="size-4 transition-transform group-hover:translate-x-0.5" />}
          </Button>

          <p className="border-t border-line pt-4 text-center text-xs text-muted">
            Parolni unutdingizmi? Administratorga murojaat qiling.
          </p>
        </form>

        <p className="absolute inset-x-0 bottom-4 text-center text-2xs text-faint">© {new Date().getFullYear()} Rombo</p>
      </div>

      {/* Showcase side — always dark, glows from the accent and the brand red */}
      <div className="relative hidden overflow-hidden bg-scrim text-white lg:block">
        <div aria-hidden className="absolute inset-0"
          style={{ background:
            "radial-gradient(60% 50% at 85% 10%, color-mix(in oklab, var(--color-accent) 55%, transparent), transparent 70%)," +
            "radial-gradient(45% 40% at 10% 95%, color-mix(in oklab, var(--color-brand) 30%, transparent), transparent 70%)" }} />
        <div aria-hidden className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "48px 48px", maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)" }} />
        <BrandMark size={460} className="pointer-events-none absolute -bottom-24 -right-24 text-white opacity-[0.05]" />

        <div className="relative flex h-full flex-col justify-between gap-10 p-12 xl:p-16">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/15 backdrop-blur">
            <span className="size-1.5 rounded-full bg-ok" /> Rombo ERP
          </span>

          <div className="grid max-w-lg gap-4">
            <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight xl:text-5xl">
              Buyurtmadan yetkazib berishgacha — <span className="text-white/60">bitta tizimda.</span>
            </h2>
            <p className="text-base text-white/70">
              Deraza, eshik va mebel ishlab chiqarish uchun: loyiha, xarid, ombor, kassa va buxgalteriya bir joyda.
            </p>
          </div>

          <ol className="grid max-w-xl grid-cols-2 gap-2.5 xl:grid-cols-3">
            {FLOW.map(([Icon, title, text], i) => (
              <li key={title}
                className="anim-pop group relative rounded-xl bg-white/[0.06] p-3.5 ring-1 ring-white/10 backdrop-blur-sm transition-colors hover:bg-white/[0.1]"
                style={{ animationDelay: `${80 + i * 50}ms` }}>
                <div className="flex items-center justify-between">
                  <span className="grid size-8 place-items-center rounded-lg bg-white/10 ring-1 ring-white/10">
                    <Icon strokeWidth={1.75} className="size-4" />
                  </span>
                  <span className="font-mono text-2xs text-white/40">0{i + 1}</span>
                </div>
                <b className="mt-3 block text-sm font-semibold">{title}</b>
                <span className="text-xs text-white/60">{text}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

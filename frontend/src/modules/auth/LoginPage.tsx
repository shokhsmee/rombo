import { ArrowRight, Eye, EyeOff, Lock, User } from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/AuthProvider";
import { BrandMark } from "@/components/Brand";
import { Button, ErrorNote, Input } from "@/components/ui";
import { apiError } from "@/lib/api";

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
    <div className="grid min-h-full bg-ground lg:grid-cols-[minmax(0,1.25fr)_minmax(420px,1fr)]">
      {/* Brand side: the Rombo mark lit like a window at night, nothing to read */}
      <div className="relative hidden overflow-hidden bg-scrim lg:grid lg:place-items-center">
        <div aria-hidden className="absolute inset-0"
          style={{ background:
            "radial-gradient(42% 46% at 50% 46%, color-mix(in oklab, var(--color-brand) 34%, transparent), transparent 72%)," +
            "radial-gradient(70% 60% at 50% 120%, color-mix(in oklab, var(--color-brand) 18%, transparent), transparent 70%)" }} />
        {/* window-frame lattice, fading out to the edges */}
        <div aria-hidden className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "linear-gradient(white 2px, transparent 2px), linear-gradient(90deg, white 2px, transparent 2px)",
            backgroundSize: "120px 120px", backgroundPosition: "center",
            maskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)" }} />
        <div aria-hidden className="login-sheen absolute inset-0" />

        <div className="relative grid justify-items-center gap-10">
          <BrandMark size={220} className="login-float text-brand drop-shadow-[0_24px_60px_color-mix(in_oklab,var(--color-brand)_55%,transparent)]" />
          <div className="grid justify-items-center gap-3 text-white">
            <span className="text-5xl font-semibold tracking-[0.32em] pl-[0.32em] xl:text-6xl">ROMBO</span>
            <span className="text-sm tracking-[0.18em] text-white/55 uppercase">фабрика сборки окон и дверей</span>
          </div>
        </div>

        <BrandMark size={640} className="pointer-events-none absolute -bottom-56 -left-56 text-white opacity-[0.03]" />
      </div>

      {/* Form side */}
      <div className="relative grid place-items-center overflow-hidden px-4 py-12 sm:px-8">
        <div aria-hidden className="pointer-events-none absolute -top-48 left-1/2 size-[560px] -translate-x-1/2 rounded-full blur-3xl lg:hidden"
          style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--color-brand) 16%, transparent), transparent 70%)" }} />

        <form onSubmit={submit} noValidate className="anim-pop relative grid w-full max-w-[360px] gap-7">
          <div className="grid justify-items-start gap-6">
            <BrandMark size={44} className="text-brand" />
            <div className="grid gap-1.5">
              <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">Tizimga kirish</h1>
              <p className="text-muted">Rombo ERP</p>
            </div>
          </div>

          <ErrorNote error={error} />

          <div className="grid gap-3">
            <div className="relative">
              <User strokeWidth={1.75} className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-faint" />
              <Input autoFocus autoComplete="username" placeholder="Login" aria-label="Login"
                className="h-12 rounded-xl pl-11 text-[15px]" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="relative">
              <Lock strokeWidth={1.75} className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-faint" />
              <Input type={show ? "text" : "password"} autoComplete="current-password" placeholder="Parol" aria-label="Parol"
                className="h-12 rounded-xl pl-11 pr-12 text-[15px]" value={password} onKeyUp={onKey} onKeyDown={onKey}
                onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShow((v) => !v)}
                aria-label={show ? "Parolni yashirish" : "Parolni ko'rsatish"} aria-pressed={show}
                className="press absolute inset-y-1.5 right-1.5 grid w-9 place-items-center rounded-lg text-muted hover:bg-sunk hover:text-ink">
                {show ? <EyeOff strokeWidth={1.75} className="size-[18px]" /> : <Eye strokeWidth={1.75} className="size-[18px]" />}
              </button>
            </div>
            {caps && <p className="text-xs font-medium text-warn">Caps Lock yoqilgan</p>}
          </div>

          <Button type="submit" busy={busy} className="group h-12 rounded-xl text-[15px]">
            Kirish
            {!busy && <ArrowRight strokeWidth={1.75} className="size-4 transition-transform group-hover:translate-x-0.5" />}
          </Button>
        </form>

        <p className="absolute inset-x-0 bottom-5 text-center text-2xs text-faint">© {new Date().getFullYear()} Rombo</p>
      </div>
    </div>
  );
}

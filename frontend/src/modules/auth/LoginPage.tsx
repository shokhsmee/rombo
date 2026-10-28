import { FileText, Factory, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/Shell";
import { Button, ErrorNote, Field, Input } from "@/components/ui";
import { apiError } from "@/lib/api";

export function LoginPage() {
  const { me, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
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

  return (
    <div className="grid min-h-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="grid place-items-center px-6 py-12">
        <form onSubmit={submit} className="grid w-full max-w-sm gap-5">
          <Logo />
          <div>
            <h1 className="t-title">Tizimga kirish</h1>
            <p className="mt-1 text-muted">Ish hisobingiz bilan kiring.</p>
          </div>
          <ErrorNote error={error} />
          <Field label="Login">
            <Input autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </Field>
          <Field label="Parol">
            <div className="relative">
              <Input type={show ? "text" : "password"} autoComplete="current-password" className="pr-20" value={password}
                onChange={(e) => setPassword(e.target.value)} />
              <button type="button" tabIndex={-1} onClick={() => setShow((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-muted hover:text-ink">
                {show ? "Yashirish" : "Ko'rsatish"}
              </button>
            </div>
          </Field>
          <Button type="submit" busy={busy} className="h-10">Kirish</Button>
          <p className="text-xs text-muted">Parolni unutdingizmi? Administratorga murojaat qiling.</p>
        </form>
      </div>
      <div className="relative hidden overflow-hidden bg-accent-ink lg:block">
        <div aria-hidden className="absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
        <div className="relative flex h-full flex-col justify-end gap-6 p-12 text-white">
          <div className="grid max-w-md gap-3">
            {[
              [FileText, "Loyihalar", "Buyurtma, shartnoma va muddat — bitta kartochkada"],
              [ShoppingCart, "Xaridlar", "Profil, oyna va furnitura — loyihaga bog'langan"],
              [Factory, "Ishlab chiqarish", "MRP: kerakli material va kamomad avtomatik"],
            ].map(([Icon, title, text]) => {
              const I = Icon as typeof FileText;
              return (
                <div key={title as string} className="flex items-start gap-3 rounded-xl bg-white/[0.07] p-3.5 ring-1 ring-white/10">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10"><I className="size-4" /></span>
                  <span><b className="block text-sm font-semibold">{title as string}</b><span className="text-sm text-white/70">{text as string}</span></span>
                </div>
              );
            })}
          </div>
          <p className="text-sm text-white/60">Rombo ERP · buyurtmadan yetkazib berishgacha</p>
        </div>
      </div>
    </div>
  );
}

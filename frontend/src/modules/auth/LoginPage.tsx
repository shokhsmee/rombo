import { Alert, Button, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/AuthProvider";
import { apiError } from "@/lib/api";

export function LoginPage() {
  const { me, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm({
    initialValues: { username: "", password: "" },
    validate: {
      username: (v) => (v.trim() ? null : "Loginni kiriting"),
      password: (v) => (v ? null : "Parolni kiriting"),
    },
  });

  if (me) return <Navigate to="/" replace />;

  const submit = form.onSubmit(async (v) => {
    setBusy(true);
    setError(null);
    try {
      await login(v.username.trim(), v.password);
      navigate((location.state as { from?: string })?.from ?? "/", { replace: true });
    } catch (e) {
      setError(apiError(e).message);
    } finally {
      setBusy(false);
    }
  });

  return (
    <div className="login-grid">
      <div style={{ display: "grid", placeItems: "center", padding: 24, background: "#fff" }}>
        <form onSubmit={submit} style={{ width: "100%", maxWidth: 340 }}>
          <Stack gap="md">
            <div>
              <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.08em" }}>
                Rombo ERP
              </Text>
              <Title order={1} mt={4}>Tizimga kirish</Title>
            </div>
            {error && <Alert color="red" variant="light" py={8}>{error}</Alert>}
            <TextInput label="Login" autoComplete="username" autoFocus {...form.getInputProps("username")} />
            <PasswordInput label="Parol" autoComplete="current-password" {...form.getInputProps("password")} />
            <Button type="submit" loading={busy} fullWidth mt={4}>
              Kirish
            </Button>
            <Text size="xs" c="dimmed">
              Parolni unutdingizmi? Administratorga murojaat qiling.
            </Text>
          </Stack>
        </form>
      </div>
      <div
        aria-hidden
        style={{
          background: "#1d4c78",
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          display: "flex",
          alignItems: "flex-end",
          padding: 40,
          color: "rgba(255,255,255,.85)",
        }}
        className="login-side"
      >
        <div style={{ maxWidth: 380 }}>
          <Text size="sm" style={{ opacity: 0.7 }}>Buyurtmadan yetkazib berishgacha</Text>
          <Text size="lg" fw={500} mt={4}>
            Loyihalar, xaridlar va ishlab chiqarish — bitta tizimda.
          </Text>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../utils/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasRecoverySession(Boolean(data.session));
      setIsCheckingSession(false);
    });
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }

    setIsSaving(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
      setIsSaving(false);
      return;
    }
    router.replace("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-sm rounded-2xl border border-border bg-card-bg p-6">
        <h1 className="text-2xl font-bold text-foreground">Cambiar contraseña</h1>
        {isCheckingSession ? (
          <p className="mt-4 text-sm text-foreground/60">Validando enlace...</p>
        ) : !hasRecoverySession ? (
          <div className="mt-4">
            <p className="text-sm text-foreground/70">El enlace no es válido o ya venció. Solicita uno nuevo desde el inicio de sesión.</p>
            <Link href="/auth/login" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">Volver al inicio de sesión</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nueva contraseña"
              minLength={6}
              autoComplete="new-password"
              required
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirma la contraseña"
              minLength={6}
              autoComplete="new-password"
              required
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground"
            />
            {message && <p role="alert" className="text-sm text-red-500">{message}</p>}
            <button type="submit" disabled={isSaving} className="w-full rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-3 font-semibold text-white disabled:opacity-50">
              {isSaving ? "Guardando..." : "Guardar contraseña nueva"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

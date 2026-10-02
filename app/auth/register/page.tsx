"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabase } from "../../utils/supabase";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function checkUsernameAvailable(usernameToCheck: string) {
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("username", usernameToCheck)
      .maybeSingle();

    if (error) {
      console.error("Error comprobando usuario:", error);
      return false;
    }

    return !data;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setError("El usuario solo puede contener letras, números y guion bajo.");
      return;
    }

    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      setError("El usuario debe tener entre 3 y 20 caracteres.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setIsLoading(true);

    try {
      const available = await checkUsernameAvailable(cleanUsername);

      if (!available) {
        setError("Ese nombre de usuario ya está registrado.");
        setIsLoading(false);
        return;
      }

      const {
        data: signUpData,
        error: signUpError,
      } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            username: cleanUsername,
            role: "user",
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setIsLoading(false);
        return;
      }

      if (!signUpData.user) {
        setError("No se pudo crear la cuenta.");
        setIsLoading(false);
        return;
      }

      const { error: profileError } = await supabase
        .from("users")
        .insert({
          id: signUpData.user.id,
          username: cleanUsername,
          role: "user",
        });

      if (profileError) {
        console.error("Error creando perfil:", profileError);

        setError(
          "La cuenta se creó, pero no se pudo guardar el perfil: " +
            profileError.message
        );

        setIsLoading(false);
        return;
      }

      setMessage(
        "Cuenta creada correctamente. Revisa tu correo para confirmar tu cuenta."
      );

      setUsername("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
      setError("Ocurrió un error inesperado.");
    }

    setIsLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-card-bg border border-border rounded-2xl p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-center text-foreground">
            Supagram
          </h1>

          <p className="text-center text-foreground/60 mt-2">
            Crea tu cuenta
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <input
              type="text"
              placeholder="Nombre de usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 outline-none"
              required
            />

            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 outline-none"
              required
            />

            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 outline-none"
              required
            />

            <input
              type="password"
              placeholder="Confirmar contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 outline-none"
              required
            />

            {error && (
              <div className="rounded-lg bg-red-100 text-red-700 px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-lg bg-green-100 text-green-700 px-4 py-3 text-sm">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-primary text-white py-3 font-semibold disabled:opacity-50"
            >
              {isLoading ? "Creando cuenta..." : "Registrarme"}
            </button>
          </form>

          <p className="text-center text-sm text-foreground/60 mt-6">
            ¿Ya tienes una cuenta?{" "}
            <Link
              href="/auth/login"
              className="text-primary font-semibold"
            >
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
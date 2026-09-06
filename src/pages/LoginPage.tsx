import { useState } from "react";
import type { FormEvent } from "react";
import API from "../services/api";
import FloatingLabelInput from "../components/FloatingLabelInput";

interface LoginPageProps {
  onLogin: () => void;
}

const getErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error !== null) {
    const maybeAxios = error as {
      response?: { data?: { error?: string } };
      message?: string;
    };
    return maybeAxios.response?.data?.error || maybeAxios.message || "Login failed";
  }
  return "Login failed";
};

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!identifier.trim() || !password) {
      setError("Enter username/email and password.");
      return;
    }

    try {
      setBusy(true);
      setError("");
      const response = await API.post("/login", {
        identifier: identifier.trim(),
        password,
      });
      const token = response.data?.token;
      if (!token) throw new Error("Login succeeded but no token was returned.");
      localStorage.setItem("pharmasys_token", token);
      onLogin();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-dvh bg-slate-100 px-4 py-8 flex items-center justify-center">
      <section className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-6 py-6 text-white">
          <h1 className="text-2xl font-bold">PharmaSys</h1>
          <p className="mt-1 text-sm text-slate-300">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <FloatingLabelInput
            id="loginIdentifier"
            label="Username / Email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <FloatingLabelInput
            id="loginPassword"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Signing in..." : "Login"}
          </button>
        </form>
      </section>
    </main>
  );
}

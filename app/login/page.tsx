"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/dashboard";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Login failed");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Themed backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-br from-primary-soft via-bg to-bg"
      />
      <div
        aria-hidden
        className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary-soft blur-3xl"
      />

      <form onSubmit={submit} className="card relative w-full max-w-sm space-y-4 shadow-md">
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <Image src="/logo.png" alt="ProBikes" width={48} height={48} className="rounded-xl" priority />
          <div>
            <h1 className="text-lg font-semibold leading-tight">ProBikes Admin</h1>
            <p className="mt-0.5 text-xs text-muted">
              Two-wheeler rental operations — bookings, payments, fleet &amp; reminders
            </p>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="username">Username</label>
          <input
            id="username"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
            autoComplete="username"
          />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {err && <p className="text-center text-sm text-danger">{err}</p>}

        <button className="btn btn-primary w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-center text-xs text-muted">
          Staff accounts are managed in-app by the shop owner.
        </p>
      </form>
    </div>
  );
}

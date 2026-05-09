"use client";

import type { FormEvent } from "react";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { UserRole } from "@/context/AuthContext";
import { useSession } from "@/context/AuthContext";

function LoginInner() {
  const { login, token, ready } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    const next = searchParams.get("next");
    router.replace(next && next.startsWith("/") ? next : "/");
  }, [ready, token, router, searchParams]);

  const completeLogin = async (res: Response) => {
    const data = (await res.json().catch(() => ({}))) as {
      detail?: string;
      access_token?: string;
      role?: string;
    };
    if (!res.ok || !data.access_token) {
      setError(data.detail ?? "Sign in failed.");
      return;
    }
    const r: UserRole | null =
      data.role === "admin" ? "admin" : data.role === "user" ? "user" : null;
    login(data.access_token, r);
    const next = searchParams.get("next");
    router.push(next && next.startsWith("/") ? next : "/");
    router.refresh();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      await completeLogin(res);
    } catch {
      setError("Could not reach the server. Try again.");
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-8 px-4 py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-sv-ink text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-sv-muted mt-2 text-sm leading-relaxed">
            Use credentials from your server environment (
            <code className="text-sv-dim">ADMIN_EMAIL</code> / <code className="text-sv-dim">ADMIN_PASSWORD</code>) or a
            registered account.
          </p>
        </div>
        <Link
          href="/register"
          className="border-sv-line text-sv-muted hover:border-sv-muted hover:text-sv-ink shrink-0 rounded-full border px-4 py-2 text-sm transition"
        >
          Join
        </Link>
      </div>

      <form onSubmit={(e) => void submit(e)} className="border-sv-line bg-sv-card/80 space-y-5 rounded-xl border p-6 backdrop-blur-sm">
        <label className="text-sv-muted block text-sm font-medium">
          Email
          <input
            className="border-sv-line bg-black/30 text-sv-ink placeholder:text-sv-dim focus:border-sv-muted mt-2 w-full rounded-lg border px-3 py-3 text-[15px] outline-none transition focus:ring-1 focus:ring-white/20"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            required
          />
        </label>
        <label className="text-sv-muted block text-sm font-medium">
          Password
          <input
            className="border-sv-line bg-black/30 text-sv-ink placeholder:text-sv-dim focus:border-sv-muted mt-2 w-full rounded-lg border px-3 py-3 text-[15px] outline-none transition focus:ring-1 focus:ring-white/20"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="text-sv-accent text-sm leading-relaxed">{error}</p>}
        <button
          type="submit"
          className="bg-sv-accent hover:bg-sv-accent-hover w-full rounded-lg py-3 text-sm font-bold text-white shadow-lg shadow-black/40 transition"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="text-sv-muted py-24 text-center">Loading…</div>}
    >
      <LoginInner />
    </Suspense>
  );
}

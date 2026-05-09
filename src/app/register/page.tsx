"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/context/AuthContext";
import { useSession } from "@/context/AuthContext";

export default function RegisterPage() {
  const { login, token, ready } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && token) router.replace("/");
  }, [ready, token, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data.detail as string) ?? "Sign up failed.");
        return;
      }
      const role: UserRole | null =
        data.role === "admin" ? "admin" : data.role === "user" ? "user" : null;
      login(data.access_token as string, role);
      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Try a different email or sign in.");
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-8 px-4 py-16">
      <div>
        <h1 className="text-sv-ink text-3xl font-bold tracking-tight">Create your profile</h1>
        <p className="text-sv-muted mt-2 text-sm leading-relaxed">
          Already registered?{" "}
          <Link
            href="/login"
            className="text-sv-ink decoration-sv-accent font-medium underline underline-offset-2 hover:text-white"
          >
            Sign in
          </Link>
          .
        </p>
      </div>

      <form
        onSubmit={(e) => void submit(e)}
        className="border-sv-line bg-sv-card/80 space-y-5 rounded-xl border p-6 backdrop-blur-sm"
      >
        <label className="text-sv-muted block text-sm font-medium">
          Email
          <input
            className="border-sv-line bg-black/30 text-sv-ink mt-2 w-full rounded-lg border px-3 py-3 text-[15px] outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            required
          />
        </label>
        <label className="text-sv-muted block text-sm font-medium">
          Password <span className="text-sv-dim font-normal">(at least 6 characters)</span>
          <input
            className="border-sv-line bg-black/30 text-sv-ink mt-2 w-full rounded-lg border px-3 py-3 text-[15px] outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
          />
        </label>
        {error && <p className="text-sv-accent text-sm">{error}</p>}
        <button
          type="submit"
          className="bg-sv-accent hover:bg-sv-accent-hover w-full rounded-lg py-3 text-sm font-bold text-white shadow-lg shadow-black/40 transition"
        >
          Create account
        </button>
      </form>
    </div>
  );
}

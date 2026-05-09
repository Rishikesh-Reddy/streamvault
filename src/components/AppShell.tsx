"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ServingInstanceBanner } from "@/components/ServingInstanceBanner";
import { useSession } from "@/context/AuthContext";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { token, role, logout } = useSession();
  const router = useRouter();

  const handleSignOut = () => {
    logout();
    router.push("/");
    router.refresh();
  };

  const year = new Date().getFullYear();

  return (
    <div className="bg-sv-page flex min-h-screen flex-col">
      <header className="border-sv-line bg-sv-page/95 sticky top-0 z-50 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <Link href="/" className="text-sv-ink text-xl font-bold tracking-tight">
            Stream<span className="text-sv-accent">Vault</span>
          </Link>
          <nav className="text-sv-muted relative z-50 flex items-center gap-4 text-sm">
            <Link href="/" className="hover:text-sv-ink transition">
              Home
            </Link>
            {token && role === "admin" && (
              <Link href="/admin" className="text-sv-dim hover:text-sv-muted transition">
                Dashboard
              </Link>
            )}
            {token ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleSignOut();
                }}
                className="border-sv-line hover:border-sv-muted hover:text-sv-ink cursor-pointer rounded border px-3 py-1.5 transition"
              >
                Sign out
              </button>
            ) : (
              <>
                <Link href="/register" className="hover:text-sv-ink transition">
                  Sign up
                </Link>
                <Link
                  href="/login"
                  className="bg-sv-accent hover:bg-sv-accent-hover rounded px-4 py-1.5 text-sm font-semibold text-white transition"
                >
                  Sign in
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-sv-line bg-black/20 space-y-3 py-10 text-center text-xs text-sv-dim">
        <ServingInstanceBanner />
        <p>© {year} StreamVault. Demo catalogue for learning.</p>
      </footer>
    </div>
  );
}

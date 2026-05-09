"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { UserRole } from "@/lib/types";

export type { UserRole };

const STORAGE_KEY = "sv_token";

export type AuthContextValue = {
  token: string | null;
  role: UserRole | null;
  ready: boolean;
  login: (token: string, role?: UserRole | null) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setToken(null);
    setRole(null);
  }, []);

  const login = useCallback((t: string, r?: UserRole | null) => {
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* private mode / quota */
    }
    setToken(t);
    if (r === "admin" || r === "user") {
      setRole(r);
    }
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- client-only localStorage hydration */
    try {
      setToken(localStorage.getItem(STORAGE_KEY));
    } catch {
      setToken(null);
    }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          logout();
          return;
        }
        const d = (await res.json()) as { role?: string };
        if (cancelled) return;
        if (d.role === "admin" || d.role === "user") setRole(d.role);
        else setRole(null);
      } catch {
        if (!cancelled) setRole(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setToken(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      role,
      ready,
      login,
      logout,
    }),
    [token, role, ready, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSession(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useSession must be used within AuthProvider");
  return ctx;
}

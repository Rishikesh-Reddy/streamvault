import type { AccountPair } from "./types";

let cache: AccountPair[] | null = null;

function parseExtraAccountsJson(raw: string): AccountPair[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: AccountPair[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const email = typeof r.email === "string" ? r.email.trim().toLowerCase() : "";
      const password = typeof r.password === "string" ? r.password : "";
      if (email && password) out.push({ email, password });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Bootstrap logins from env only — no credentials in source code.
 * - `ADMIN_EMAIL` + `ADMIN_PASSWORD`: seed user written with `role = admin` in SQLite
 * - `EXTRA_ACCOUNTS_JSON`: optional `[{ "email", "password" }, ...]` for extra viewers
 */
export function getSeedAccounts(): AccountPair[] {
  if (cache) return cache;
  const out: AccountPair[] = [];

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (adminEmail && adminPassword) {
    out.push({ email: adminEmail, password: adminPassword });
  }

  const extra = process.env.EXTRA_ACCOUNTS_JSON?.trim();
  if (extra) {
    for (const a of parseExtraAccountsJson(extra)) {
      if (!out.some((x) => x.email === a.email)) out.push(a);
    }
  }

  cache = out;
  return out;
}

/** For tests / hot reload during dev (optional). */
export function resetSeedAccountsCache() {
  cache = null;
}

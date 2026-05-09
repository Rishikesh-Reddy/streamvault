import type { UserRole } from "./types";
import { getDb } from "./db";

/**
 * Users live in SQLite (`users` table with `role`). Registered accounts are always `user`;
 * admin is determined by the `role` column (e.g. env seed sync sets admin for `ADMIN_EMAIL`).
 * Passwords are stored in plain text for local demo only.
 */

export function findPasswordForEmail(email: string): string | undefined {
  const key = email.toLowerCase();
  const row = getDb()
    .prepare("SELECT password FROM users WHERE email = ?")
    .get(key) as { password: string } | undefined;
  return row?.password;
}

export function getRoleForEmail(email: string): UserRole | null {
  const row = getDb()
    .prepare("SELECT role FROM users WHERE email = ?")
    .get(email.toLowerCase()) as { role: string } | undefined;
  if (!row) return null;
  return row.role === "admin" ? "admin" : "user";
}

export function tryRegister(email: string, password: string): "ok" | "exists" {
  const key = email.toLowerCase();
  const exists = getDb().prepare("SELECT 1 FROM users WHERE email = ?").get(key);
  if (exists) return "exists";
  getDb()
    .prepare("INSERT INTO users (email, password, role) VALUES (?, ?, 'user')")
    .run(key, password);
  return "ok";
}

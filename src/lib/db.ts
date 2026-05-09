import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { getSeedAccounts } from "./env-accounts";

let db: Database.Database | null = null;

/**
 * Sync env bootstrap accounts into SQLite. The admin account gets `role = 'admin'`
 * (from `ADMIN_EMAIL` at sync time); all other seeds are `user`.
 */
function syncSeedUsers(database: Database.Database) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const upsert = database.prepare(
    `INSERT INTO users (email, password, role)
     VALUES (@email, @password, @role)
     ON CONFLICT(email) DO UPDATE SET
       password = excluded.password,
       role = excluded.role`,
  );
  for (const a of getSeedAccounts()) {
    const role = a.email === adminEmail ? "admin" : "user";
    upsert.run({ email: a.email.toLowerCase(), password: a.password, role });
  }
}

export function getDb(): Database.Database {
  if (db) return db;
  const file =
    process.env.DATABASE_PATH?.trim() || path.join(process.cwd(), "data", "streamvault.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const database = new Database(file);
  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY COLLATE NOCASE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'user'))
    );
  `);
  syncSeedUsers(database);
  db = database;
  return database;
}

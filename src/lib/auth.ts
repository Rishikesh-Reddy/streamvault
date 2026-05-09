import { SignJWT, jwtVerify } from "jose";
import { getRoleForEmail } from "./user-store";
import type { UserRole } from "./types";

export type { UserRole };

function secretKey() {
  const s = process.env.JWT_SECRET ?? "streamvault-local-dev-secret";
  return new TextEncoder().encode(s);
}

export async function signAccessToken(email: string) {
  const normalized = email.trim().toLowerCase();
  const role = getRoleForEmail(normalized);
  if (!role) {
    throw new Error("Cannot issue token: user not found");
  }
  return new SignJWT({ sub: normalized, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export type AccessPayload = { email: string; role: UserRole };

/** Role is always loaded from the database so JWTs stay aligned with the `users.role` column. */
export async function verifyAccessToken(token: string): Promise<AccessPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const email = typeof payload.sub === "string" ? payload.sub : null;
    if (!email) return null;
    const role = getRoleForEmail(email);
    if (role === null) return null;
    return { email, role };
  } catch {
    return null;
  }
}

/** @deprecated Prefer verifyAccessToken for role-aware checks. */
export async function verifyToken(token: string): Promise<string | null> {
  const p = await verifyAccessToken(token);
  return p?.email ?? null;
}

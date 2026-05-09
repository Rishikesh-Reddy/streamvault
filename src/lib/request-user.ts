import { verifyAccessToken, type AccessPayload } from "./auth";

export async function userFromRequest(req: Request): Promise<AccessPayload | null> {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const token = h.slice(7).trim();
  if (!token) return null;
  return verifyAccessToken(token);
}

export async function emailFromAuthHeader(req: Request): Promise<string | null> {
  const u = await userFromRequest(req);
  return u?.email ?? null;
}

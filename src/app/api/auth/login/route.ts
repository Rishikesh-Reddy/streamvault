import { NextResponse } from "next/server";

import { signAccessToken } from "@/lib/auth";
import { findPasswordForEmail, getRoleForEmail } from "@/lib/user-store";
import { seedDemoProgressIfNeeded } from "@/lib/watch-store";

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const expected = findPasswordForEmail(email);
  if (!expected || password !== expected) {
    return NextResponse.json({ detail: "Invalid email or password" }, { status: 401 });
  }
  seedDemoProgressIfNeeded(email);
  const access_token = await signAccessToken(email);
  const role = getRoleForEmail(email) ?? "user";
  return NextResponse.json({ access_token, token_type: "bearer", role });
}

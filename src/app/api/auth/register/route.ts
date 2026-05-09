import { NextResponse } from "next/server";

import { signAccessToken } from "@/lib/auth";
import { getRoleForEmail, tryRegister } from "@/lib/user-store";

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON" }, { status: 400 });
  }
  const email = (body.email ?? "").trim();
  const password = (body.password ?? "").trim();
  if (!email || password.length < 6) {
    return NextResponse.json({ detail: "Email required; password at least 6 characters." }, { status: 400 });
  }
  const result = tryRegister(email, password);
  if (result === "exists") {
    return NextResponse.json({ detail: "Email already registered." }, { status: 409 });
  }
  const access_token = await signAccessToken(email.toLowerCase());
  const role = getRoleForEmail(email.toLowerCase()) ?? "user";
  return NextResponse.json({ access_token, token_type: "bearer", role });
}

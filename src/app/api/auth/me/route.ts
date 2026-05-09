import { NextResponse } from "next/server";

import { userFromRequest } from "@/lib/request-user";

export async function GET(req: Request) {
  const u = await userFromRequest(req);
  if (!u) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ email: u.email, role: u.role });
}

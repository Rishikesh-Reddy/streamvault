import { NextResponse } from "next/server";

import { continueWatchingFor } from "@/lib/watch-store";
import { emailFromAuthHeader } from "@/lib/request-user";

export async function GET(req: Request) {
  const email = await emailFromAuthHeader(req);
  if (!email) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(continueWatchingFor(email));
}

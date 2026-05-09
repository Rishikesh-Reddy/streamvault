import { NextResponse } from "next/server";

import { getSeedAccounts } from "@/lib/env-accounts";

/** Emails only — never return passwords. */
export async function GET() {
  const emails = getSeedAccounts().map((a) => a.email);
  return NextResponse.json({ emails });
}

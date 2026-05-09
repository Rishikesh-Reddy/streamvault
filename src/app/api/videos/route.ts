import { NextRequest, NextResponse } from "next/server";

import { getCatalog, searchVideos } from "@/lib/catalog";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length >= 2) {
    return NextResponse.json(searchVideos(q));
  }
  return NextResponse.json(getCatalog());
}

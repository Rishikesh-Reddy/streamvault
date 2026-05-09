import { NextResponse } from "next/server";

import { trendingVideos } from "@/lib/catalog";

export async function GET() {
  return NextResponse.json(trendingVideos());
}

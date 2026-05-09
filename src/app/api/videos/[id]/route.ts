import { NextResponse } from "next/server";

import { getVideoById } from "@/lib/catalog";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (Number.isNaN(n)) {
    return NextResponse.json({ detail: "Invalid id" }, { status: 400 });
  }
  const video = getVideoById(n);
  if (!video) {
    return NextResponse.json({ detail: "Not found" }, { status: 404 });
  }
  return NextResponse.json(video);
}

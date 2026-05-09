import { NextResponse } from "next/server";

import { getCatalog, getVideoById, writeCatalog } from "@/lib/catalog";
import { userFromRequest } from "@/lib/request-user";
import type { Video } from "@/lib/types";

function isVideoBody(v: unknown): v is Video {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (
    typeof o.id !== "number" ||
    typeof o.title !== "string" ||
    typeof o.description !== "string" ||
    typeof o.poster_url !== "string" ||
    typeof o.stream_url !== "string" ||
    typeof o.category !== "string" ||
    typeof o.year !== "number" ||
    typeof o.rating !== "number" ||
    typeof o.trending !== "boolean"
  ) {
    return false;
  }
  if (o.runtime_label !== undefined && typeof o.runtime_label !== "string") return false;
  return true;
}

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const u = await userFromRequest(req);
  if (!u) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  if (u.role !== "admin") return NextResponse.json({ detail: "Forbidden" }, { status: 403 });

  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (Number.isNaN(id)) return NextResponse.json({ detail: "Bad id" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON" }, { status: 400 });
  }
  if (!isVideoBody(body)) {
    return NextResponse.json({ detail: "Invalid video payload" }, { status: 400 });
  }
  if (body.id !== id) {
    return NextResponse.json({ detail: "ID mismatch" }, { status: 400 });
  }

  const existing = getVideoById(id);
  if (!existing) return NextResponse.json({ detail: "Not found" }, { status: 404 });

  const list = getCatalog();
  const idx = list.findIndex((x) => x.id === id);
  if (idx < 0) return NextResponse.json({ detail: "Not found" }, { status: 404 });

  const next = [...list];
  next[idx] = body;
  writeCatalog(next);
  return NextResponse.json(body);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const u = await userFromRequest(_req);
  if (!u) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  if (u.role !== "admin") return NextResponse.json({ detail: "Forbidden" }, { status: 403 });

  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (Number.isNaN(id)) return NextResponse.json({ detail: "Bad id" }, { status: 400 });

  const list = getCatalog();
  if (!list.some((x) => x.id === id)) {
    return NextResponse.json({ detail: "Not found" }, { status: 404 });
  }
  writeCatalog(list.filter((x) => x.id !== id));
  return new NextResponse(null, { status: 204 });
}

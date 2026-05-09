import { NextResponse } from "next/server";

import { getCatalog, writeCatalog } from "@/lib/catalog";
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

export async function GET(req: Request) {
  const u = await userFromRequest(req);
  if (!u) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  if (u.role !== "admin") return NextResponse.json({ detail: "Forbidden" }, { status: 403 });
  return NextResponse.json(getCatalog());
}

export async function POST(req: Request) {
  const u = await userFromRequest(req);
  if (!u) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  if (u.role !== "admin") return NextResponse.json({ detail: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON" }, { status: 400 });
  }
  if (!isVideoBody(body)) {
    return NextResponse.json({ detail: "Invalid video payload" }, { status: 400 });
  }
  const list = getCatalog();
  if (list.some((x) => x.id === body.id)) {
    return NextResponse.json({ detail: "ID already exists" }, { status: 409 });
  }
  writeCatalog([...list, body].sort((a, b) => a.id - b.id));
  return NextResponse.json(body, { status: 201 });
}

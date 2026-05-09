import { NextResponse } from "next/server";

import { setWatchProgress } from "@/lib/watch-store";
import { emailFromAuthHeader } from "@/lib/request-user";

export async function POST(req: Request) {
  const email = await emailFromAuthHeader(req);
  if (!email) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  let body: { video_id?: number; progress_sec?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON" }, { status: 400 });
  }
  const videoId = Number(body.video_id);
  const progressSec = Number(body.progress_sec);
  if (Number.isNaN(videoId) || Number.isNaN(progressSec)) {
    return NextResponse.json({ detail: "video_id and progress_sec required" }, { status: 400 });
  }
  setWatchProgress(email, videoId, progressSec);
  return NextResponse.json({ ok: true });
}

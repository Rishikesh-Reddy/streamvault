"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { VideoMetaDetails } from "@/components/VideoMetaDetails";
import { posterForVideo } from "@/lib/posters";
import { streamDetailsForUrl } from "@/lib/stream-details";
import type { Video } from "@/lib/types";

export default function VideoDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [video, setVideo] = useState<Video | null>(null);

  useEffect(() => {
    const run = async () => {
      const res = await fetch(`/api/videos/${id}`);
      if (!res.ok) {
        setVideo(null);
        return;
      }
      setVideo((await res.json()) as Video);
    };
    void run();
  }, [id]);

  const stream = useMemo(() => (video ? streamDetailsForUrl(video.stream_url) : null), [video]);

  if (!video || !stream) {
    return <div className="text-sv-muted min-h-[40vh] p-12 text-center">Loading…</div>;
  }

  const poster = posterForVideo(video);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:items-start">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.06]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={poster} alt={video.title} className="aspect-video w-full object-cover" />
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-sm bg-white/10 px-2.5 py-1 text-xs font-semibold tracking-wide text-white uppercase">
              {video.category}
            </span>
            {video.trending && (
              <span className="rounded-sm bg-red-600 px-2.5 py-1 text-xs font-bold tracking-wide text-white uppercase">
                Trending
              </span>
            )}
          </div>

          <h1 className="text-sv-ink text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">{video.title}</h1>

          <div className="text-sv-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-sm md:text-base">
            <span className="font-semibold text-green-400">{video.rating.toFixed(1)} match</span>
            <span className="text-zinc-600">·</span>
            <span>{video.year}</span>
            {video.runtime_label && (
              <>
                <span className="text-zinc-600">·</span>
                <span>{video.runtime_label}</span>
              </>
            )}
          </div>

          <Link
            href={`/watch/${video.id}`}
            className="inline-flex items-center gap-2 rounded bg-white px-10 py-3 text-sm font-bold text-black transition hover:bg-zinc-200"
          >
            ▶ Play now
          </Link>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-wide text-zinc-400 uppercase">About this title</h2>
            <p className="text-sv-muted max-w-2xl text-base leading-relaxed md:text-lg">{video.description}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-wide text-zinc-400 uppercase">Details</h2>
            <VideoMetaDetails video={video} stream={stream} variant="full" />
          </section>
        </div>
      </div>
    </div>
  );
}

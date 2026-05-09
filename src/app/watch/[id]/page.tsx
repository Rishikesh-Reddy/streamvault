"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { VideoMetaDetails } from "@/components/VideoMetaDetails";
import { WatchVideoPlayer } from "@/components/WatchVideoPlayer";
import { useSession } from "@/context/AuthContext";
import { posterForStreamUrl } from "@/lib/posters";
import { streamDetailsForUrl } from "@/lib/stream-details";
import type { Video } from "@/lib/types";

const FALLBACK_MP4 =
  "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4";

function pickStreamUrl(raw: Video): string {
  const u = raw.stream_url?.trim();
  if (u) return u;
  return FALLBACK_MP4;
}

export default function WatchPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const { token } = useSession();
  const lastTimeRef = useRef(0);
  const playingRef = useRef(false);
  const triedFallback = useRef(false);
  const [video, setVideo] = useState<Video | null>(null);
  const [playSrc, setPlaySrc] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);

  const stream = useMemo(() => (playSrc ? streamDetailsForUrl(playSrc) : null), [playSrc]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setMetaError(null);
      if (!id || Number.isNaN(Number(id))) {
        setMetaError("Invalid video link.");
        setVideo(null);
        setPlaySrc(null);
        return;
      }
      try {
        const res = await fetch(`/api/videos/${id}`);
        if (!res.ok) throw new Error("not found");
        const data = (await res.json()) as Video;
        if (!cancelled) {
          setVideo(data);
          setPlaySrc(pickStreamUrl(data));
          setMediaError(null);
          triedFallback.current = false;
        }
      } catch {
        if (!cancelled) {
          setVideo(null);
          setPlaySrc(null);
          setMetaError("Could not load this title.");
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!video || !token) return;
    const timer = window.setInterval(async () => {
      if (!playingRef.current) return;
      try {
        await fetch("/api/watch/progress", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            video_id: video.id,
            progress_sec: Math.floor(lastTimeRef.current),
          }),
        });
      } catch {
        /* best-effort */
      }
    }, 20_000);
    return () => clearInterval(timer);
  }, [video, token]);

  if (metaError) {
    return <div className="text-sv-accent p-12 text-center">{metaError}</div>;
  }

  if (!video || !playSrc || !stream) {
    return <div className="text-sv-muted p-12 text-center">Loading player…</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:space-y-10 md:px-8">
      <header className="space-y-3">
        <p className="text-sv-accent text-xs font-semibold tracking-[0.2em] uppercase">Now playing</p>
        <h1 className="text-sv-ink text-3xl font-bold tracking-tight md:text-4xl">{video.title}</h1>
        <div className="text-sv-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-sm md:text-base">
          <span className="font-semibold text-green-400">{video.rating.toFixed(1)} match</span>
          <span className="text-zinc-600">·</span>
          <span>{video.year}</span>
          <span className="text-zinc-600">·</span>
          <span>{video.category}</span>
          {video.runtime_label && (
            <>
              <span className="text-zinc-600">·</span>
              <span>{video.runtime_label}</span>
            </>
          )}
        </div>
      </header>

      <WatchVideoPlayer
        key={`${video.id}-${playSrc}`}
        src={playSrc}
        poster={posterForStreamUrl(playSrc, video.id)}
        autoPlay
        fallbackSources={[FALLBACK_MP4]}
        onPlaybackError={() => {
          if (!triedFallback.current && playSrc !== FALLBACK_MP4) {
            triedFallback.current = true;
            setMediaError("Switching to an alternate stream…");
            setPlaySrc(FALLBACK_MP4);
          } else {
            setMediaError("Playback failed. Check your connection or try again later.");
          }
        }}
        onPlay={() => {
          playingRef.current = true;
        }}
        onPause={() => {
          playingRef.current = false;
        }}
        onTimeUpdate={(t) => {
          lastTimeRef.current = t;
        }}
      />

      {mediaError && (
        <p className="rounded border border-amber-700/40 bg-amber-950/35 px-3 py-2 text-sm text-amber-100/95">
          {mediaError}
        </p>
      )}

      <section className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 md:p-6">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Synopsis</h2>
        <p className="text-sv-muted max-w-3xl text-base leading-relaxed md:text-lg">{video.description}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Stream info</h2>
        <VideoMetaDetails video={video} stream={stream} variant="compact" />
      </section>
    </div>
  );
}

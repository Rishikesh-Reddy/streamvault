import Link from "next/link";
import type { Video } from "@/lib/types";
import { posterForVideo } from "@/lib/posters";

export function VideoCard({ video }: { video: Video }) {
  const poster = posterForVideo(video);

  return (
    <Link
      href={`/video/${video.id}`}
      className="group/card focus-visible:ring-sv-accent block w-[min(46vw,220px)] shrink-0 overflow-visible rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141414] sm:w-[200px] md:w-[220px]"
    >
      <div className="relative origin-center overflow-hidden rounded-md bg-zinc-900 shadow-[0_4px_24px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.06] transition duration-300 ease-out after:pointer-events-none after:absolute after:inset-0 after:rounded-md after:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] group-hover/card:scale-[1.08] group-hover/card:shadow-[0_16px_48px_rgba(0,0,0,0.85)] group-hover/card:ring-white/20 motion-reduce:transition-none motion-reduce:group-hover/card:scale-100">
        <div className="aspect-video w-full overflow-hidden bg-zinc-950">
          {/* eslint-disable-next-line @next/next/no-img-element -- external poster URLs */}
          <img
            src={poster}
            alt={video.title}
            className="h-full w-full object-cover transition duration-500 group-hover/card:brightness-110 motion-reduce:group-hover/card:brightness-100"
            loading="lazy"
            decoding="async"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-transparent opacity-90" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent" />
        </div>

        <div className="absolute right-0 bottom-0 left-0 space-y-1 p-2.5 pt-10 sm:p-3 sm:pt-12">
          <p className="line-clamp-2 text-[13px] leading-snug font-semibold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] sm:text-sm">
            {video.title}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-300 sm:text-xs">
            <span className="font-semibold text-green-400">{video.rating.toFixed(1)}</span>
            <span className="text-zinc-600">·</span>
            <span>{video.year}</span>
            {video.trending && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="rounded bg-red-600/90 px-1.5 py-px text-[10px] font-bold tracking-wide text-white uppercase">
                  Hot
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

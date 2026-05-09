import Link from "next/link";
import type { Video } from "@/lib/types";
import { posterForVideo } from "@/lib/posters";

export function Hero({ featured }: { featured: Video | null }) {
  if (!featured) return null;
  const poster = posterForVideo(featured);

  return (
    <section className="hero-gradient relative overflow-hidden rounded-lg">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.22] blur-3xl"
        style={{ backgroundImage: `url(${poster})`, backgroundSize: "cover", backgroundPosition: "center" }}
        aria-hidden
      />
      <div className="relative grid gap-8 p-8 md:grid-cols-[1.15fr_0.85fr] md:p-10 md:pr-12">
        <div className="space-y-5">
          <p className="text-xs font-bold tracking-[0.35em] text-red-500 uppercase">Spotlight</p>
          <h1 className="text-4xl leading-[1.05] font-bold tracking-tight text-white drop-shadow-md md:text-5xl lg:text-6xl">
            {featured.title}
          </h1>
          <p className="text-sv-muted line-clamp-4 max-w-xl text-base leading-relaxed md:text-lg">
            {featured.description}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
            <span className="font-semibold text-green-400">{featured.rating.toFixed(1)} match</span>
            <span className="text-zinc-600">·</span>
            <span>{featured.year}</span>
            <span className="text-zinc-600">·</span>
            <span className="rounded border border-white/15 bg-white/5 px-2 py-0.5 text-xs font-medium text-zinc-200">
              {featured.category}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href={`/watch/${featured.id}`}
              className="inline-flex items-center gap-2 rounded bg-white px-8 py-2.5 text-sm font-bold text-black transition hover:bg-zinc-200"
            >
              <span aria-hidden>▶</span> Play now
            </Link>
            <Link
              href={`/video/${featured.id}`}
              className="text-sv-ink hover:bg-white/12 inline-flex items-center gap-2 rounded border border-white/25 bg-white/5 px-8 py-2.5 text-sm font-semibold backdrop-blur-sm transition"
            >
              More info
            </Link>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-sm md:max-w-none">
          <div className="aspect-[3/4] overflow-hidden rounded-md border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.75)] ring-1 ring-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element -- external poster URLs */}
            <img src={poster} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="bg-sv-accent/20 pointer-events-none absolute -inset-12 -z-10 rounded-full blur-3xl" />
        </div>
      </div>
    </section>
  );
}

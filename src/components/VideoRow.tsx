import { VideoCard } from "@/components/VideoCard";
import type { Video } from "@/lib/types";

export function VideoRow({ title, videos }: { title: string; videos: Video[] }) {
  if (!videos.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-100 md:text-xl">{title}</h2>
      <div className="sv-video-rail -mx-4 flex gap-2 overflow-x-auto overflow-y-visible px-4 pb-2 md:-mx-8 md:gap-3 md:px-8 md:pb-3">
        {videos.map((v) => (
          <VideoCard key={v.id} video={v} />
        ))}
      </div>
    </section>
  );
}

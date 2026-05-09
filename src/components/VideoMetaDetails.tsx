import type { StreamDetails } from "@/lib/stream-details";
import type { Video } from "@/lib/types";

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2">
      <p className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-zinc-100">{value}</p>
    </div>
  );
}

export function VideoMetaDetails({
  video,
  stream,
  variant = "full",
}: {
  video: Video;
  stream: StreamDetails;
  variant?: "full" | "compact";
}) {
  const cols = variant === "full" ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2";

  return (
    <div className={`grid gap-2 ${cols}`}>
      <MetaChip label="Content" value={video.category} />
      <MetaChip label="Release year" value={String(video.year)} />
      <MetaChip label="Viewer score" value={`${video.rating.toFixed(1)} / 5`} />
      {video.runtime_label && <MetaChip label="Approx. length" value={video.runtime_label} />}
      {stream.resolutionHint && <MetaChip label="Stream resolution" value={stream.resolutionHint} />}
      <MetaChip label="Container" value={stream.container} />
      <MetaChip label="Source" value={stream.source} />
      <MetaChip label="License" value={stream.license} />
      <MetaChip label="Delivery" value={stream.streamKind} />
    </div>
  );
}

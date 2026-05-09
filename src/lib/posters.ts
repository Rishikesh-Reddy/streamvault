import type { Video } from "./types";

const U = "https://images.unsplash.com";

const Q = "?w=1200&h=675&fit=crop&auto=format&q=85";

/** Verified Unsplash photo IDs — each pool must stay in sync with query `Q` above. */
const POOLS = {
  /** Sintel / fantasy (Durian trailers) */
  sintel: [
    `${U}/photo-1513002749550-c59d786b8e6c${Q}`,
    `${U}/photo-1472214103451-9374bd1c798e${Q}`,
    `${U}/photo-1506905925346-21bda4d32df4${Q}`,
    `${U}/photo-1579546929518-9e396f3cc809${Q}`,
    `${U}/photo-1550745165-9bc0b252726f${Q}`,
    `${U}/photo-1469474968028-56623f02e42e${Q}`,
    `${U}/photo-1441974231531-c6227db76b6e${Q}`,
  ],
  /** Big Buck Bunny, W3 mov_bbb — meadows / bunny energy */
  bunny: [
    `${U}/photo-1535083783855-76ae62b2914e${Q}`,
    `${U}/photo-1501004318641-b39e6451bec6${Q}`,
    `${U}/photo-1441974231531-c6227db76b6e${Q}`,
    `${U}/photo-1469474968028-56623f02e42e${Q}`,
    `${U}/photo-1506905925346-21bda4d32df4${Q}`,
    `${U}/photo-1579546929518-9e396f3cc809${Q}`,
    `${U}/photo-1416879595882-3373a0480b5b${Q}`,
  ],
  /** MDN flower clips */
  flowers: [
    `${U}/photo-1490750967868-88aa4486c946${Q}`,
    `${U}/photo-1416879595882-3373a0480b5b${Q}`,
    `${U}/photo-1558618666-fcd25c85cd64${Q}`,
    `${U}/photo-1469474968028-56623f02e42e${Q}`,
    `${U}/photo-1506905925346-21bda4d32df4${Q}`,
    `${U}/photo-1472214103451-9374bd1c798e${Q}`,
    `${U}/photo-1441974231531-c6227db76b6e${Q}`,
    `${U}/photo-1579546929518-9e396f3cc809${Q}`,
  ],
  /** MDN rabbit320 clips */
  labClip: [
    `${U}/photo-1583511655857-d19b40a7a54e${Q}`,
    `${U}/photo-1535083783855-76ae62b2914e${Q}`,
    `${U}/photo-1501004318641-b39e6451bec6${Q}`,
    `${U}/photo-1472214103451-9374bd1c798e${Q}`,
    `${U}/photo-1558618666-fcd25c85cd64${Q}`,
    `${U}/photo-1490750967868-88aa4486c946${Q}`,
    `${U}/photo-1416879595882-3373a0480b5b${Q}`,
  ],
  /** FileSamples / “cinema” neutral */
  cinema: [
    `${U}/photo-1485846234645-a62644f84728${Q}`,
    `${U}/photo-1489599849927-2ee91cede3ba${Q}`,
    `${U}/photo-1550745165-9bc0b252726f${Q}`,
    `${U}/photo-1506905925346-21bda4d32df4${Q}`,
    `${U}/photo-1472214103451-9374bd1c798e${Q}`,
    `${U}/photo-1579546929518-9e396f3cc809${Q}`,
    `${U}/photo-1513002749550-c59d786b8e6c${Q}`,
    `${U}/photo-1469474968028-56623f02e42e${Q}`,
  ],
  fallback: [`${U}/photo-1469474968028-56623f02e42e${Q}`, `${U}/photo-1441974231531-c6227db76b6e${Q}`, `${U}/photo-1506905925346-21bda4d32df4${Q}`],
} as const;

function pickFromPool(pool: readonly string[], streamKey: string, distinctKey: number): string {
  if (pool.length === 0) return POOLS.fallback[0] ?? "";
  let h = 2166136261;
  const str = `${streamKey}:${distinctKey}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = Math.abs(h) % pool.length;
  return pool[idx] ?? pool[0];
}

/**
 * Posters follow the stream URL theme but rotate when many titles share one file,
 * using `distinctKey` (usually `video.id`) for a stable, unique image per row.
 */
export function posterForStreamUrl(streamUrl: string, distinctKey = 0): string {
  const u = streamUrl.toLowerCase();

  if (u.includes("durian/trailer/sintel")) return pickFromPool(POOLS.sintel, u, distinctKey);

  if (u.includes("cc0-videos/flower")) return pickFromPool(POOLS.flowers, u, distinctKey);

  if (u.includes("rabbit320")) return pickFromPool(POOLS.labClip, u, distinctKey);

  if (u.includes("peach/bigbuckbunny") || u.includes("mov_bbb.mp4"))
    return pickFromPool(POOLS.bunny, u, distinctKey);

  if (u.includes("filesamples.com")) return pickFromPool(POOLS.cinema, u, distinctKey);

  return pickFromPool(POOLS.fallback, u, distinctKey);
}

export function posterForVideo(video: Video): string {
  return posterForStreamUrl(video.stream_url, video.id);
}

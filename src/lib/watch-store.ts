import { getCatalog, getVideoById } from "./catalog";
import { getSeedAccounts } from "./env-accounts";
import type { Video } from "./types";

/** user email → video id → last progress seconds */
const progressByUser = new Map<string, Map<number, number>>();

function bucket(email: string) {
  let m = progressByUser.get(email);
  if (!m) {
    m = new Map();
    progressByUser.set(email, m);
  }
  return m;
}

export function setWatchProgress(email: string, videoId: number, progressSec: number) {
  bucket(email).set(videoId, Math.max(0, Math.floor(progressSec)));
}

export function continueWatchingFor(email: string): Video[] {
  const m = progressByUser.get(email);
  if (!m?.size) return [];
  const pairs = [...m.entries()].filter(([, sec]) => sec > 15);
  const withVideo = pairs
    .map(([id, progress_sec]) => {
      const v = getVideoById(id);
      return v ? { video: v, progress_sec } : null;
    })
    .filter(Boolean) as { video: Video; progress_sec: number }[];
  return withVideo.map((x) => x.video).slice(0, 12);
}

/** Seed some progress on first sign-in for env bootstrap accounts (first extra or admin). */
export function seedDemoProgressIfNeeded(email: string) {
  const key = email.toLowerCase();
  const firstSeed = getSeedAccounts()[0]?.email.toLowerCase();
  if (!firstSeed || key !== firstSeed) return;
  const m = bucket(email);
  if (m.size > 0) return;
  const sample = getCatalog().slice(0, 3);
  sample.forEach((v, i) => {
    m.set(v.id, Math.min(120 + (i + 1) * 45, 600));
  });
}

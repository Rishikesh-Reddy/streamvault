import fs from "node:fs";
import path from "node:path";

import type { Video } from "./types";

const CATALOG_PATH = path.join(process.cwd(), "src", "data", "videos.json");

function readFile(): Video[] {
  const raw = fs.readFileSync(CATALOG_PATH, "utf8");
  return JSON.parse(raw) as Video[];
}

/** Full catalog from disk (reflects admin edits without rebuild). */
export function getCatalog(): Video[] {
  return readFile();
}

export function writeCatalog(videos: Video[]): void {
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(videos, null, 2) + "\n", "utf8");
}

export function getVideoById(id: number): Video | undefined {
  return getCatalog().find((v) => v.id === id);
}

export function searchVideos(q: string): Video[] {
  const s = q.trim().toLowerCase();
  if (s.length < 2) return [];
  return getCatalog().filter(
    (v) =>
      v.title.toLowerCase().includes(s) ||
      v.description.toLowerCase().includes(s) ||
      v.category.toLowerCase().includes(s)
  );
}

export function trendingVideos(): Video[] {
  return getCatalog().filter((v) => v.trending);
}

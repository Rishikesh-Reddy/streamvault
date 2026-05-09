"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { posterForVideo } from "@/lib/posters";
import type { Video } from "@/lib/types";

async function fetchSearch(q: string): Promise<Video[]> {
  const res = await fetch(`/api/videos?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  return res.json();
}

export function SearchBar() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Video[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (q.length < 2) {
        setResults([]);
        return;
      }
      const data = await fetchSearch(q);
      if (!cancelled) setResults(data.slice(0, 8));
    };
    const t = window.setTimeout(run, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="relative w-full max-w-xl">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search titles..."
        className="border-sv-line bg-black/40 text-sv-ink placeholder:text-sv-dim focus:border-sv-muted focus:ring-white/20 w-full rounded border px-5 py-2.5 text-sm ring-0 outline-none transition focus:ring-1"
      />
      {results.length > 0 && (
        <div className="border-sv-line bg-sv-card shadow-card absolute z-50 mt-1 w-full overflow-hidden rounded border">
          {results.map((v) => (
            <Link
              key={v.id}
              href={`/video/${v.id}`}
              className="text-sv-ink hover:bg-sv-line flex items-center gap-3 px-3 py-2.5 text-sm"
              onClick={() => setQ("")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={posterForVideo(v)}
                alt=""
                className="h-11 w-[4.5rem] shrink-0 rounded object-cover ring-1 ring-white/10"
              />
              <span className="truncate">{v.title}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Hero } from "@/components/Hero";
import { SearchBar } from "@/components/SearchBar";
import { VideoRow } from "@/components/VideoRow";
import { useSession } from "@/context/AuthContext";
import type { Video } from "@/lib/types";

export default function HomePage() {
  const { token, ready } = useSession();
  const [all, setAll] = useState<Video[]>([]);
  const [trending, setTrending] = useState<Video[]>([]);
  const [cont, setCont] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const [a, t] = await Promise.all([
        fetch("/api/videos").then((r) => r.json() as Promise<Video[]>),
        fetch("/api/videos/trending").then((r) => r.json() as Promise<Video[]>),
      ]);
      setAll(a);
      setTrending(t);
      setLoading(false);
    };
    void run();
  }, []);

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/watch/continue", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("unauthorized");
        const data = (await res.json()) as Video[];
        if (!cancelled) setCont(data);
      } catch {
        if (!cancelled) setCont([]);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [token, ready]);

  const byCat = useMemo(() => {
    const m = new Map<string, Video[]>();
    for (const v of all) {
      if (!m.has(v.category)) m.set(v.category, []);
      m.get(v.category)!.push(v);
    }
    return m;
  }, [all]);

  const featured = trending[0] || all[0] || null;

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-sv-ink text-2xl font-bold md:text-3xl">Tonight on StreamVault</h1>
        </div>
        <SearchBar />
      </div>

      {!ready || loading ? (
        <div className="text-sv-muted py-24 text-center">Loading…</div>
      ) : (
        <>
          <Hero featured={featured} />
          {token && cont.length > 0 && <VideoRow title="Continue watching" videos={cont} />}
          <VideoRow title="Trending now" videos={trending} />
          {Array.from(byCat.entries()).map(([cat, vids]) => (
            <VideoRow key={cat} title={cat} videos={vids} />
          ))}
        </>
      )}
    </div>
  );
}

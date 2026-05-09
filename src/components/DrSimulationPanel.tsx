"use client";

import { useCallback, useEffect, startTransition, useState } from "react";

type SimMode = "off" | "pre_disaster" | "disaster";

type SimResp = {
  ok: boolean;
  simulation?: {
    explicitMode: SimMode | string;
    runningWorkers: number;
    spinningSinceIso: string | null;
    lastAutoClearMessage: string | null;
    lastAutoClearAt: string | null;
    rampDownActive: boolean;
  };
  effectiveMode?: string;
  cpu_helpers_unavailable?: boolean;
  cpuStressAllowed?: boolean;
  cpuStressBlockReason?: string | null;
  appliedMode?: SimMode | string;
  error?: string;
};

export function DrSimulationPanel({ token }: { token: string }) {
  const [data, setData] = useState<SimResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [setting, setSetting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const poll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/simulate-load", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = (await res.json()) as SimResp;
      if (!res.ok || !body.ok) {
        setData(null);
        setErr((body as { error?: string }).error ?? res.statusText);
        return;
      }
      setData(body);
    } catch (e) {
      setData(null);
      setErr(e instanceof Error ? e.message : "simulate-load failed");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const applyMode = async (mode: SimMode) => {
    if (!token) return;
    setSetting(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/simulate-load", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode }),
      });
      const body = (await res.json()) as SimResp & { appliedMode?: string };
      if (!res.ok || !body.ok) {
        setErr((body as { error?: string }).error ?? res.statusText);
        return;
      }
      setData(body);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "POST simulate-load failed");
    } finally {
      setSetting(false);
    }
  };

  useEffect(() => {
    startTransition(() => {
      void poll();
    });
    const id = window.setInterval(() => {
      startTransition(() => {
        void poll();
      });
    }, 8000);
    return () => clearInterval(id);
  }, [poll]);

  const s = data?.simulation;
  /** Until first snapshot, defer stress buttons except Clear (handles stray workers). */
  const allowStress = Boolean(data?.cpuStressAllowed);

  return (
    <section className="border-sv-line space-y-4 rounded-xl border p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sv-muted text-sm uppercase tracking-wider">DR demo (primary only)</p>
          <h2 className="text-sv-ink mt-1 text-lg font-semibold">CPU stress controls</h2>
          <p className="text-sv-muted mt-2 max-w-2xl text-sm">
            Applies only on the primary app EC2 · warm / failback / DR cold — tell the story in AWS Console.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void poll()}
          disabled={loading}
          className="border-sv-line text-sv-ink hover:bg-white/5 shrink-0 rounded border px-4 py-2 text-sm transition disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {!allowStress && data && (
        <p className="text-sv-dim rounded border border-sv-line bg-black/30 px-3 py-2 text-sm">
          {data?.cpuStressBlockReason ??
            "Synthetic CPU is disabled here (typically the DR standby). Use primary admin dashboard for load."}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={setting || !allowStress}
          onClick={() => void applyMode("pre_disaster")}
          className="rounded-lg border border-amber-700/70 bg-amber-950/40 px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-950/60 disabled:opacity-45"
        >
          Pre‑disaster simulate
        </button>
        <button
          type="button"
          disabled={setting || !allowStress}
          onClick={() => void applyMode("disaster")}
          className="rounded-lg border border-red-700/70 bg-red-950/35 px-4 py-2.5 text-sm font-semibold text-red-50 transition hover:bg-red-950/55 disabled:opacity-45"
        >
          Disaster simulate
        </button>
        <button
          type="button"
          disabled={setting}
          onClick={() => void applyMode("off")}
          className="border-sv-line text-sv-muted hover:text-sv-ink rounded-lg border px-4 py-2.5 text-sm font-semibold transition hover:bg-white/5 disabled:opacity-50"
        >
          Clear
        </button>
      </div>
      {setting ? <p className="text-sv-dim text-xs">Applying…</p> : null}
      {err ? (
        <p className="rounded border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-sm text-amber-50">{err}</p>
      ) : null}

      {data?.cpu_helpers_unavailable ? (
        <p className="rounded border border-amber-800/70 bg-amber-950/25 px-3 py-2 text-xs text-amber-50">
          Helpers did not fork — run from repo root (<code className="text-sv-muted">cpu-spin-child.cjs</code>).
        </p>
      ) : null}

      {s && (
        <div className="border-sv-line bg-sv-card/50 rounded-lg border px-4 py-3 text-sm">
          <p className="text-sv-dim text-xs uppercase">Load state</p>
          <p className="text-sv-ink font-mono text-sm">{data?.effectiveMode ?? s.explicitMode}</p>
          <p className="text-sv-dim mt-1 text-[11px]">
            Workers: {s.runningWorkers}
            {s.spinningSinceIso ? ` · started ${new Date(s.spinningSinceIso).toLocaleTimeString()}` : ""}
          </p>
          {s.lastAutoClearMessage && (
            <p className="text-sv-muted mt-2 border-t border-white/5 pt-2 text-[11px] leading-relaxed">
              Auto: {s.lastAutoClearMessage}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

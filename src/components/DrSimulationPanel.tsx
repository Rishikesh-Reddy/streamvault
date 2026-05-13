"use client";

import { useCallback, useEffect, startTransition, useState } from "react";

type SimMode = "off" | "pre_disaster" | "disaster";

type InfraResp = { ok?: boolean; error?: string; action?: string; route53Weights?: string };

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
  /** null = not loaded yet */
  const [manualFailoverDnsOn, setManualFailoverDnsOn] = useState<boolean | null>(null);
  const [manualFailoverDnsLoading, setManualFailoverDnsLoading] = useState(false);
  const [manualFailoverDnsSaving, setManualFailoverDnsSaving] = useState(false);
  /** null = unknown; deployed false = no Lambda lab; true + enabled = predictive auto-failover toggle */
  const [predictiveToggle, setPredictiveToggle] = useState<
    null | { deployed: false } | { deployed: true; enabled: boolean | null }
  >(null);
  const [predictiveLoading, setPredictiveLoading] = useState(false);
  const [predictiveSaving, setPredictiveSaving] = useState(false);

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

  const loadManualFailoverDnsToggle = useCallback(async () => {
    if (!token) return;
    setManualFailoverDnsLoading(true);
    try {
      const res = await fetch("/api/admin/manual-route53-dr", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = (await res.json()) as { ok?: boolean; enabled?: boolean; error?: string };
      if (res.ok && body?.ok && typeof body.enabled === "boolean") {
        setManualFailoverDnsOn(body.enabled);
      } else {
        setManualFailoverDnsOn(null);
      }
    } catch {
      setManualFailoverDnsOn(null);
    } finally {
      setManualFailoverDnsLoading(false);
    }
  }, [token]);

  const loadPredictiveDrToggle = useCallback(async () => {
    if (!token) return;
    setPredictiveLoading(true);
    try {
      const res = await fetch("/api/admin/predictive-dr-failover", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = (await res.json()) as {
        ok?: boolean;
        predictiveLabDeployed?: boolean;
        enabled?: boolean;
        error?: string;
      };
      if (!res.ok || !body?.ok) {
        setPredictiveToggle({ deployed: false });
        return;
      }
      if (body.predictiveLabDeployed !== true) {
        setPredictiveToggle({ deployed: false });
        return;
      }
      setPredictiveToggle({ deployed: true, enabled: typeof body.enabled === "boolean" ? body.enabled : null });
    } catch {
      setPredictiveToggle({ deployed: false });
    } finally {
      setPredictiveLoading(false);
    }
  }, [token]);

  const persistPredictiveDrToggle = async (enabled: boolean) => {
    if (!token) return;
    setPredictiveSaving(true);
    try {
      const res = await fetch("/api/admin/predictive-dr-failover", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled }),
      });
      const body = (await res.json()) as { ok?: boolean; enabled?: boolean; error?: string };
      if (!res.ok || !body?.ok || typeof body.enabled !== "boolean") {
        setErr(body.error ?? `Could not save predictive setting (HTTP ${res.status})`);
        return;
      }
      setPredictiveToggle({ deployed: true, enabled: body.enabled });
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Predictive save failed");
    } finally {
      setPredictiveSaving(false);
    }
  };

  const persistManualFailoverDnsToggle = async (enabled: boolean) => {
    if (!token) return;
    setManualFailoverDnsSaving(true);
    try {
      const res = await fetch("/api/admin/manual-route53-dr", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled }),
      });
      const body = (await res.json()) as { ok?: boolean; enabled?: boolean; error?: string };
      if (!res.ok || !body?.ok || typeof body.enabled !== "boolean") {
        setErr(body.error ?? `Could not save setting (HTTP ${res.status})`);
        return;
      }
      setManualFailoverDnsOn(body.enabled);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setManualFailoverDnsSaving(false);
    }
  };

  const infraAction = async (
    action: string,
  ): Promise<(InfraResp & { ok?: boolean; error?: string }) | null> => {
    if (!token) return null;
    const res = await fetch("/api/admin/demo-phase", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action }),
    });
    let body = {} as InfraResp & { ok?: boolean; error?: string };
    try {
      body = (await res.json()) as InfraResp & { ok?: boolean; error?: string };
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      return { ...body, ok: false, error: body.error ?? `demo-phase HTTP ${res.status}` };
    }
    return body;
  };

  const applyMode = async (mode: SimMode) => {
    if (!token) return;
    setSetting(true);
    setErr(null);
    try {
      if (mode === "pre_disaster") {
        const i = await infraAction("pre_disaster");
        if (!i?.ok) {
          setErr(i?.error ?? "demo-phase pre_disaster failed");
          setSetting(false);
          return;
        }
      }
      if (mode === "disaster") {
        const i = await infraAction("disaster");
        if (!i?.ok) {
          setErr(i?.error ?? "demo-phase disaster failed");
          setSetting(false);
          return;
        }
      }

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
        setSetting(false);
        return;
      }
      setData(body);
      if (mode === "off") {
        const fb = await infraAction("failback");
        if (!fb?.ok) {
          setErr(fb?.error ?? "demo-phase failback failed");
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "POST simulate-load failed");
    } finally {
      setSetting(false);
    }
  };

  const runInfrastructure = async (action: "failback" | "normalize") => {
    if (!token) return;
    setSetting(true);
    setErr(null);
    try {
      const i = await infraAction(action);
      if (!i?.ok) {
        setErr(i?.error ?? `demo-phase ${action} failed`);
        return;
      }
      await poll();
    } finally {
      setSetting(false);
    }
  };

  useEffect(() => {
    startTransition(() => {
      void poll();
      void loadManualFailoverDnsToggle();
      void loadPredictiveDrToggle();
    });
    const id = window.setInterval(() => {
      startTransition(() => {
        void poll();
        void loadManualFailoverDnsToggle();
        void loadPredictiveDrToggle();
      });
    }, 8000);
    return () => clearInterval(id);
  }, [poll, loadManualFailoverDnsToggle, loadPredictiveDrToggle]);

  const s = data?.simulation;
  /** Until first snapshot, defer stress buttons except Clear (handles stray workers). */
  const allowStress = Boolean(data?.cpuStressAllowed);

  return (
    <section className="border-sv-line space-y-4 rounded-xl border p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sv-muted text-sm uppercase tracking-wider">DR demo (primary admin only)</p>
          <h2 className="text-sv-ink mt-1 text-lg font-semibold">Classroom storyline</h2>
          <p className="text-sv-muted mt-2 max-w-2xl text-sm">
            Follow the storyline: simulate stress, run the failure steps, then return to normal. Use the two switches below to
            pause admin-driven DNS changes or scheduled predictive failover independently.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void poll();
            void loadManualFailoverDnsToggle();
            void loadPredictiveDrToggle();
          }}
          disabled={loading || manualFailoverDnsLoading || predictiveLoading}
          className="border-sv-line text-sv-ink hover:bg-white/5 shrink-0 rounded border px-4 py-2 text-sm transition disabled:opacity-50"
        >
          {loading || manualFailoverDnsLoading || predictiveLoading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {!allowStress && data && (
        <p className="text-sv-dim rounded border border-sv-line bg-black/30 px-3 py-2 text-sm">
          {data?.cpuStressBlockReason ??
            "Synthetic CPU is disabled here (typically the DR standby). Use primary admin dashboard for load."}
        </p>
      )}

      <div className="border-sv-line flex flex-wrap items-start justify-between gap-4 rounded-lg border bg-black/20 px-3 py-3">
        <div className="min-w-0 max-w-xl">
          <p className="text-sv-ink text-sm font-medium">Manual traffic failover</p>
          <p className="text-sv-dim mt-1 text-xs leading-relaxed">
            Controls whether storyline steps can steer viewer traffic. When disabled, standby servers may still start, but
            routing stays as-is unless something else manages it.
          </p>
        </div>
        <label className="text-sv-muted flex shrink-0 cursor-pointer items-center gap-2.5 pt-1 text-sm">
          <span className="select-none">
            {manualFailoverDnsSaving
              ? "Saving…"
              : manualFailoverDnsLoading || manualFailoverDnsOn === null
                ? "Checking…"
                : manualFailoverDnsOn
                  ? "Routing changes on"
                  : "Routing changes off"}
          </span>
          <input
            type="checkbox"
            className="border-sv-line text-amber-500 focus:ring-amber-500/40 h-4 w-4 rounded border bg-black/40"
            checked={manualFailoverDnsOn === true}
            disabled={manualFailoverDnsSaving || manualFailoverDnsLoading || manualFailoverDnsOn === null}
            onChange={(e) =>
              startTransition(() => {
                void persistManualFailoverDnsToggle(e.target.checked);
              })
            }
          />
        </label>
      </div>

      <div className="border-sv-line flex flex-wrap items-start justify-between gap-4 rounded-lg border bg-black/20 px-3 py-3">
        <div className="min-w-0 max-w-xl">
          <p className="text-sv-ink text-sm font-medium">Predictive traffic failover</p>
          <p className="text-sv-dim mt-1 text-xs leading-relaxed">
            When on, the scheduled DR Lambda may shift viewer traffic when primary CPU or the SageMaker signal crosses the
            lab thresholds—and returns to normal Terraform weights automatically when metrics look healthy again. Turn off here
            to freeze automatic shifts (running the Lambda restore path if it had shifted).
          </p>
          {predictiveToggle?.deployed === false ? (
            <p className="text-sv-muted mt-2 text-[11px] leading-relaxed">
              Not deployed: enable predictive DR in Terraform and rebuild the primary app instance so STREAMVAULT_DEMO_PREDICTIVE_LAMBDA is set.
            </p>
          ) : null}
        </div>
        <label className="text-sv-muted flex shrink-0 cursor-pointer items-center gap-2.5 pt-1 text-sm">
          <span className="select-none">
            {predictiveSaving
              ? "Saving…"
              : predictiveLoading || predictiveToggle === null || predictiveToggle.deployed !== true
                ? predictiveToggle?.deployed === false
                  ? "N/A"
                  : "Checking…"
                : predictiveToggle.enabled
                  ? "Automatic on"
                  : "Automatic off"}
          </span>
          <input
            type="checkbox"
            className="border-sv-line text-amber-500 focus:ring-amber-500/40 h-4 w-4 rounded border bg-black/40"
            checked={predictiveToggle?.deployed === true && predictiveToggle.enabled === true}
            disabled={
              predictiveSaving ||
              predictiveLoading ||
              predictiveToggle === null ||
              predictiveToggle.deployed !== true ||
              predictiveToggle.enabled === null
            }
            onChange={(e) =>
              startTransition(() => {
                void persistPredictiveDrToggle(e.target.checked);
              })
            }
          />
        </label>
      </div>

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
          Clear load + Route53 → primary
        </button>
      </div>
      <div className="flex flex-wrap gap-3 border-t border-white/5 pt-4">
        <button
          type="button"
          disabled={setting}
          onClick={() => void (async () => {
            setSetting(true);
            setErr(null);
            const i = await infraAction("baseline");
            setSetting(false);
            if (!i?.ok) setErr(i?.error ?? "baseline failed");
            else await poll();
          })()}
          className="border-sv-line text-sv-dim hover:text-sv-ink rounded-lg border px-3 py-2 text-xs font-semibold"
        >
          Infra baseline (neutral DNS + cold DR EC2 stop)
        </button>
        <button
          type="button"
          disabled={setting}
          onClick={() => void runInfrastructure("failback")}
          className="border-sv-line text-sv-dim hover:text-sv-ink rounded-lg border px-3 py-2 text-xs font-semibold"
        >
          Route53 failback heavy-primary
        </button>
        <button
          type="button"
          disabled={setting}
          onClick={() => void runInfrastructure("normalize")}
          className="border-sv-line text-sv-dim hover:text-sv-ink rounded-lg border px-3 py-2 text-xs font-semibold"
        >
          Cold standby (neutral DNS + stop DR)
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

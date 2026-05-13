"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminCatalogPanel } from "@/components/AdminCatalogPanel";
import { DrSimulationPanel } from "@/components/DrSimulationPanel";
import { useSession } from "@/context/AuthContext";

type MetricPoint = { t: string; v: number };

type Dashboard = {
  instanceId: string;
  region: string;
  availabilityZone?: string;
  instanceType?: string;
  state?: string;
  launchTime?: string;
  metricsUnavailable?: string;
  cpuPercent: MetricPoint[];
  networkInBytes: MetricPoint[];
  networkOutBytes: MetricPoint[];
  diskReadBytes?: MetricPoint[];
  diskWriteBytes?: MetricPoint[];
  summary: {
    cpuLatest: number | null;
    cpuLatestAt: string | null;
    cpuPeakInWindow: number | null;
    networkInLast5mAvgBytes: number | null;
    networkOutLast5mAvgBytes: number | null;
  };
};

type InstanceOpt = { instanceId: string; region: string; label?: string };

type ApiOk = {
  ok: true;
  data: Dashboard;
  hours: number;
  serving: (InstanceOpt & { availabilityZone?: string }) | null;
  instances: InstanceOpt[];
  requestedTarget: { instanceId: string; region: string };
};
type ApiErr = { ok: false; error: string };

function instanceKey(i: { instanceId: string; region: string }) {
  return `${i.instanceId}\t${i.region}`;
}

function formatBytes(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—";
  if (n < 1024) return `${n.toFixed(0)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
}

function Sparkline({ points, maxHint }: { points: MetricPoint[]; maxHint?: number }) {
  if (!points.length) return <p className="text-sv-dim text-sm">No samples in this window.</p>;
  const vals = points.map((p) => p.v);
  const max = maxHint ?? Math.max(0.001, ...vals);
  return (
    <div className="flex h-14 max-w-full items-end gap-px overflow-x-auto pb-1" aria-hidden>
      {points.map((p, i) => (
        <div
          key={`${p.t}-${i}`}
          className="min-w-[3px] flex-1 rounded-t bg-red-600/80"
          style={{ height: `${Math.max(4, (p.v / max) * 100)}%` }}
          title={`${p.t}: ${p.v.toFixed(2)}`}
        />
      ))}
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { token, role, ready } = useSession();
  const [hours, setHours] = useState(3);
  const [metricsPick, setMetricsPick] = useState<{ instanceId: string; region: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ApiOk | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!token) router.replace("/login?next=/admin");
  }, [ready, token, router]);

  const loadMetrics = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ hours: String(hours) });
      if (metricsPick) {
        qs.set("instanceId", metricsPick.instanceId);
        qs.set("region", metricsPick.region);
      }
      const res = await fetch(`/api/admin/metrics?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as ApiOk | ApiErr;
      if (res.status === 403) {
        setPayload(null);
        setError("You need an admin account to view metrics.");
        return;
      }
      if (!res.ok || !body.ok) {
        setPayload(null);
        setError("error" in body && body.error ? body.error : res.statusText);
        return;
      }
      setPayload(body);
    } catch (e) {
      setPayload(null);
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [hours, metricsPick, token]);

  useEffect(() => {
    if (!ready || !token || role !== "admin") return;
    const id = requestAnimationFrame(() => {
      void loadMetrics();
    });
    return () => cancelAnimationFrame(id);
  }, [ready, token, role, loadMetrics]);

  const d = payload?.data;
  const metricsFor = payload ? payload.requestedTarget : null;
  const chartsMatchServing =
    !payload?.serving ||
    !metricsFor ||
    (payload.serving.instanceId === metricsFor.instanceId &&
      payload.serving.region === metricsFor.region);

  const cpuMax = useMemo(() => {
    if (!d?.cpuPercent.length) return 100;
    return Math.max(100, ...d.cpuPercent.map((p) => p.v));
  }, [d]);

  if (!ready || !token) {
    return <div className="text-sv-muted py-24 text-center">Checking session…</div>;
  }

  if (role === null) {
    return <div className="text-sv-muted py-24 text-center">Loading profile…</div>;
  }

  if (role !== "admin") {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-20 text-center">
        <h1 className="text-sv-ink text-2xl font-bold">Access restricted</h1>
        <p className="text-sv-muted text-sm">
          Only accounts with <code className="text-sv-ink">admin</code> in the database{" "}
          <code className="text-sv-ink">users.role</code> column can open this page. Update roles in SQLite or adjust
          env seed sync, then sign in again if needed.
        </p>
        <Link href="/" className="text-sv-accent inline-block text-sm font-semibold">
          ← Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 md:px-8">
      <div>
        <p className="text-sv-muted text-sm uppercase tracking-wider">Operations</p>
        <h1 className="text-sv-ink mt-1 text-3xl font-bold">Admin dashboard</h1>
      </div>

      <section className="border-sv-line space-y-4 rounded-xl border p-5 md:p-6">
        {payload && payload.serving && (
          <div className="bg-sv-card/80 border-sv-line rounded-lg border px-4 py-3 text-sm">
            <span className="text-sv-dim">This request was served by </span>
            <code className="text-sv-ink font-mono text-xs">{payload.serving.instanceId}</code>
            <span className="text-sv-dim"> · </span>
            <span className="text-sv-ink">{payload.serving.region}</span>
            {payload.serving.availabilityZone && (
              <>
                <span className="text-sv-dim"> · </span>
                <span className="text-sv-muted">{payload.serving.availabilityZone}</span>
              </>
            )}
          </div>
        )}

        {metricsFor && payload && payload.serving && !chartsMatchServing && (
          <p className="text-sv-muted text-sm">
            Charts below are for the selected instance ({metricsFor.instanceId}, {metricsFor.region}
            ), not necessarily the server that responded above.
          </p>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-sv-ink text-lg font-semibold">Instance metrics</h2>
          <div className="flex flex-wrap items-center gap-2">
            {payload && payload.instances.length > 0 ? (
              <label className="text-sv-dim flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-2">
                <span className="shrink-0">Instance</span>
                <select
                  value={
                    metricsPick
                      ? instanceKey(metricsPick)
                      : metricsFor
                        ? instanceKey(metricsFor)
                        : ""
                  }
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (!raw) {
                      setMetricsPick(null);
                      return;
                    }
                    const [instanceId, region] = raw.split("\t");
                    if (!instanceId || !region) return;
                    setMetricsPick({ instanceId, region });
                  }}
                  className="border-sv-line bg-black/30 text-sv-ink max-w-[min(100vw-4rem,24rem)] rounded border px-2 py-1.5 text-xs sm:text-sm"
                >
                  {payload.instances.map((inst) => (
                    <option key={instanceKey(inst)} value={instanceKey(inst)}>
                      {inst.label ? `${inst.label} · ` : ""}
                      {inst.instanceId} ({inst.region})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="text-sv-dim flex items-center gap-2 text-sm">
              Window
              <select
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="border-sv-line bg-black/30 text-sv-ink rounded border px-2 py-1.5 text-sm"
              >
                {[1, 3, 6, 12, 24, 48].map((h) => (
                  <option key={h} value={h}>
                    {h}h
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void loadMetrics()}
              disabled={loading}
              className="border-sv-line text-sv-ink hover:bg-white/5 rounded border px-4 py-2 text-sm transition disabled:opacity-50"
            >
              {loading ? "Loading…" : "Refresh metrics"}
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-amber-300">{error}</p>}
        <p className="text-sv-dim max-w-3xl text-xs leading-relaxed">
          Numbers are smoothed averages for each bucket in your time window—they can lag sharp spikes briefly. Compare the
          big number with Peak in window for the same stretch.
        </p>
      </section>

      <DrSimulationPanel token={token} />

      {d && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border-sv-line bg-sv-card rounded-xl border p-4">
              <p className="text-sv-dim text-xs uppercase">CPU (CloudWatch)</p>
              <p className="text-sv-ink mt-1 text-2xl font-bold">
                {d.summary.cpuLatest !== null ? `${d.summary.cpuLatest.toFixed(1)}%` : "—"}
              </p>
              {d.summary.cpuPeakInWindow !== null && (
                <p className="text-sv-muted mt-2 text-sm">
                  Peak in selected window:{" "}
                  <span className="text-sv-ink font-semibold">
                    {d.summary.cpuPeakInWindow.toFixed(1)}%
                  </span>
                </p>
              )}
              {d.summary.cpuLatestAt && (
                <p className="text-sv-dim mt-1 text-xs">
                  CloudWatch timestamp: {new Date(d.summary.cpuLatestAt).toLocaleString()}
                </p>
              )}
            </div>
            <div className="border-sv-line bg-sv-card rounded-xl border p-4">
              <p className="text-sv-dim text-xs uppercase">Network in (last period)</p>
              <p className="text-sv-ink mt-1 text-2xl font-bold">
                {formatBytes(d.summary.networkInLast5mAvgBytes)}
              </p>
            </div>
            <div className="border-sv-line bg-sv-card rounded-xl border p-4">
              <p className="text-sv-dim text-xs uppercase">Network out (last period)</p>
              <p className="text-sv-ink mt-1 text-2xl font-bold">
                {formatBytes(d.summary.networkOutLast5mAvgBytes)}
              </p>
            </div>
            <div className="border-sv-line bg-sv-card rounded-xl border p-4">
              <p className="text-sv-dim text-xs uppercase">State</p>
              <p className="text-sv-ink mt-1 text-2xl font-bold capitalize">{d.state ?? "—"}</p>
            </div>
          </div>

          <div className="border-sv-line bg-sv-card/40 grid gap-4 rounded-xl border p-5 md:grid-cols-2">
            <div>
              <p className="text-sv-dim text-xs uppercase">Instance</p>
              <p className="text-sv-ink font-mono text-sm">{d.instanceId}</p>
            </div>
            <div>
              <p className="text-sv-dim text-xs uppercase">Region / AZ</p>
              <p className="text-sv-ink text-sm">
                {d.region}
                {d.availabilityZone ? ` · ${d.availabilityZone}` : ""}
              </p>
            </div>
            <div>
              <p className="text-sv-dim text-xs uppercase">Type</p>
              <p className="text-sv-ink text-sm">{d.instanceType ?? "—"}</p>
            </div>
            <div>
              <p className="text-sv-dim text-xs uppercase">Launched</p>
              <p className="text-sv-ink text-sm">
                {d.launchTime ? new Date(d.launchTime).toLocaleString() : "—"}
              </p>
            </div>
          </div>

          {d.metricsUnavailable && (
            <p className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100/90">
              {d.metricsUnavailable}
            </p>
          )}

          <div className="grid gap-8 lg:grid-cols-2">
            <section className="border-sv-line space-y-3 rounded-xl border bg-black/20 p-5">
              <h3 className="text-sv-ink font-semibold">CPU utilization</h3>
              <Sparkline points={d.cpuPercent} maxHint={cpuMax} />
            </section>
            <section className="border-sv-line space-y-3 rounded-xl border bg-black/20 p-5">
              <h3 className="text-sv-ink font-semibold">Network in (bytes / period)</h3>
              <Sparkline points={d.networkInBytes} />
            </section>
            <section className="border-sv-line space-y-3 rounded-xl border bg-black/20 p-5">
              <h3 className="text-sv-ink font-semibold">Network out (bytes / period)</h3>
              <Sparkline points={d.networkOutBytes} />
            </section>
            {d.diskReadBytes?.length || d.diskWriteBytes?.length ? (
              <section className="border-sv-line space-y-3 rounded-xl border bg-black/20 p-5">
                <h3 className="text-sv-ink font-semibold">EBS bytes</h3>
                {d.diskReadBytes?.length ? (
                  <>
                    <p className="text-sv-dim text-xs">Read</p>
                    <Sparkline points={d.diskReadBytes} />
                  </>
                ) : null}
                {d.diskWriteBytes?.length ? (
                  <>
                    <p className="text-sv-dim mt-3 text-xs">Write</p>
                    <Sparkline points={d.diskWriteBytes} />
                  </>
                ) : null}
              </section>
            ) : null}
          </div>
        </>
      )}

      <AdminCatalogPanel token={token} />
    </div>
  );
}

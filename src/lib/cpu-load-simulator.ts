import { spawn, type ChildProcess } from "child_process";
import path from "path";

export type SimMode = "off" | "pre_disaster" | "disaster";

export type CpuSnapshot = {
  explicitMode: SimMode;
  runningWorkers: number;
  spinningSinceIso: string | null;
  lastAutoClearMessage: string | null;
  lastAutoClearAt: string | null;
  rampDownActive: boolean;
};

let lastAutoClearMessage: string | null = null;
let lastAutoClearAt: string | null = null;

let explicitMode: SimMode = "off";
let spinningSinceIso: string | null = null;
let watchers: ChildProcess[] = [];

let routeWatchInitialized = false;

let rampKillTimer: ReturnType<typeof setInterval> | null = null;
let rampDownActive = false;

function normalizeToken(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

/** Declared tier for DR demo wiring (PRIMARY runs synthetic CPU only). */
export function declaredTrafficTier(): "primary" | "dr" | "unset" {
  const raw =
    normalizeToken(process.env.STREAMVAULT_TRAFFIC_ROLE ?? "") ||
    normalizeToken(process.env.STREAMVAULT_ENDPOINT_ROLE ?? "");
  if (!raw) return "unset";
  if (raw === "dr" || raw === "backup" || raw === "secondary") return "dr";
  if (raw === "primary" || raw === "main" || raw === "prod" || raw === "active-west")
    return "primary";
  return "unset";
}

/** Admin CPU buttons only operate on PRIMARY tier hosts. */
export function cpuStressSimulationAllowed(): boolean {
  if ((process.env.STREAMVAULT_ALLOW_DR_SIMULATE ?? "").trim() === "1") return true;
  return declaredTrafficTier() !== "dr";
}

export function cpuSimulationBlockReason(): string | null {
  if (cpuStressSimulationAllowed()) return null;
  return "Synthetic CPU load runs on primary tier EC2 only (STREAMVAULT_TRAFFIC_ROLE != dr).";
}

function hostIamRegionGuess(): string | null {
  const fromEnv =
    process.env.STREAMVAULT_HOST_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    process.env.AWS_DEFAULT_REGION?.trim();
  return fromEnv ? normalizeToken(fromEnv) : null;
}

function workerTargets(): { pre_disaster: number; disaster: number } {
  const pre = Number(process.env.STREAMVAULT_LOAD_WORKERS_PRE ?? "1");
  const dis = Number(process.env.STREAMVAULT_LOAD_WORKERS_DISASTER ?? "3");
  return {
    pre_disaster: Math.max(1, Number.isFinite(pre) ? Math.floor(pre) : 1),
    disaster: Math.max(2, Number.isFinite(dis) ? Math.floor(dis) : 3),
  };
}

function rampKillMs(): number {
  const ms = Number(process.env.STREAMVAULT_RAMP_KILL_INTERVAL_MS ?? "12000");
  if (!Number.isFinite(ms)) return 12000;
  return Math.min(60000, Math.max(3000, Math.floor(ms)));
}

function cancelRampKillTimer() {
  if (rampKillTimer) {
    clearInterval(rampKillTimer);
    rampKillTimer = null;
  }
  rampDownActive = false;
}

/**
 * Drops one spinner every interval until none remain; then resets explicit preset.
 */
function beginGradualRampDown(summary: string) {
  if (explicitMode === "off" && watchers.length === 0) {
    cancelRampKillTimer();
    return;
  }
  if (rampDownActive) return;

  rampDownActive = true;
  const iv = rampKillMs();
  watchers = watchers.filter((c) => !c.killed && c.exitCode === null);

  const tick = () => {
    watchers = watchers.filter((c) => !c.killed && c.exitCode === null);
    const tail = watchers.pop();
    try {
      tail?.kill("SIGTERM");
    } catch {
      /* ignore */
    }

    watchers = watchers.filter((c) => !c.killed && c.exitCode === null);

    if (watchers.length === 0) {
      explicitMode = "off";
      spinningSinceIso = null;
      lastAutoClearMessage = `${summary} Synthetic load eased to zero (scheduled ramp).`;
      lastAutoClearAt = new Date().toISOString();
      cancelRampKillTimer();
    }
  };

  tick();
  rampKillTimer = setInterval(tick, iv);

  if (typeof rampKillTimer.unref === "function") rampKillTimer.unref();
}

export function spawnSpinWorkers(count: number) {
  cancelRampKillTimer();
  stopSpinWorkersOnly();
  if (count <= 0) return;
  const script = path.resolve(process.cwd(), "cpu-spin-child.cjs");

  const maxWorkers = Number(process.env.STREAMVAULT_MAX_LOAD_WORKERS ?? "8");
  const cap =
    Number.isFinite(maxWorkers) ? Math.min(24, Math.max(1, Math.floor(maxWorkers))) : 8;
  const finalCount = Math.min(count, cap);

  for (let i = 0; i < finalCount; i++) {
    try {
      const child = spawn(process.execPath, [script], {
        detached: false,
        stdio: "ignore",
        windowsHide: true,
      });
      child.on("error", () => {
        try {
          child.kill("SIGTERM");
        } catch {
          /* ignore */
        }
      });
      watchers.push(child);
    } catch {
      break;
    }
  }

  spinningSinceIso = watchers.length ? new Date().toISOString() : null;
}

export function stopSpinWorkersOnly() {
  for (const child of watchers) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  watchers = [];
  spinningSinceIso = null;
}

export function clearSimulation(reason?: string | null) {
  cancelRampKillTimer();
  explicitMode = "off";
  stopSpinWorkersOnly();
  if (reason) {
    lastAutoClearMessage = reason;
    lastAutoClearAt = new Date().toISOString();
  }
}

export function setSimulationMode(mode: SimMode) {
  cancelRampKillTimer();
  if (mode !== "off" && explicitMode !== mode) lastAutoClearMessage = null;

  explicitMode = mode;
  if (mode === "off") {
    stopSpinWorkersOnly();
    return;
  }

  const t = workerTargets();
  const n =
    mode === "pre_disaster" ? Math.min(t.pre_disaster, t.disaster) : t.disaster;
  spawnSpinWorkers(n);
}

export function snapshot(): CpuSnapshot {
  watchers = watchers.filter((c) => !c.killed && c.exitCode === null);

  let runningWorkers = 0;
  for (const c of watchers) {
    if (!c.killed && c.exitCode === null) runningWorkers += 1;
  }

  if (runningWorkers === 0 && explicitMode !== "off" && !rampDownActive)
    spinningSinceIso = null;

  return {
    explicitMode,
    runningWorkers,
    spinningSinceIso,
    lastAutoClearMessage,
    lastAutoClearAt,
    rampDownActive,
  };
}

function looksLikeIamRegion(s: string): boolean {
  return /^[a-z]{2}-\w+-\d+$/.test(s);
}

async function pullActiveTrafficToken(): Promise<{ token: string | null; err: string | null }> {
  const rawUrl = process.env.STREAMVAULT_TRAFFIC_REGION_URL?.trim();
  if (!rawUrl) return { token: null, err: null };
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 5500);
    const res = await fetch(rawUrl, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(id);
    const text = (await res.text()).trim();
    if (!res.ok) return { token: null, err: `HTTP ${res.status}` };

    try {
      const j = JSON.parse(text) as Record<string, unknown>;
      const r =
        (typeof j.region === "string" && j.region) ||
        (typeof j.activeRegion === "string" && j.activeRegion) ||
        (typeof j.trafficRegion === "string" && j.trafficRegion) ||
        (typeof j.active === "string" && j.active) ||
        (typeof j.role === "string" && j.role) ||
        (typeof j.endpoint === "string" && j.endpoint);

      const token =
        typeof r === "string" && r.trim() ? normalizeToken(r.trim()) : null;
      if (token) return { token, err: null };
    } catch {
      /* tolerate plain-text body */
    }

    const flat = /^[a-z0-9_-]{2,128}$/.test(text) ? normalizeToken(text) : null;
    return flat
      ? { token: flat, err: null }
      : {
          token: null,
          err: "Unreadable traffic beacon — reply with JSON {\"region\":\"us-west-2\"} or {\"active\":\"primary\"}.",
        };
  } catch (e) {
    return {
      token: null,
      err: e instanceof Error ? e.message : String(e),
    };
  }
}

async function evaluateTrafficMismatch() {
  if (!process.env.STREAMVAULT_TRAFFIC_REGION_URL?.trim()) return;
  if ((process.env.STREAMVAULT_DISABLE_TRAFFIC_WATCH ?? "").trim() === "1") return;

  const pulled = await pullActiveTrafficToken();
  if (!pulled.token || pulled.err) return;

  const active = pulled.token;

  const role =
    normalizeToken(process.env.STREAMVAULT_TRAFFIC_ROLE ?? "") ||
    normalizeToken(process.env.STREAMVAULT_ENDPOINT_ROLE ?? "");
  const hostRg = hostIamRegionGuess();

  let mismatch = false;
  let reason = "";

  if (looksLikeIamRegion(active)) {
    const compare = hostRg;
    if (compare && active !== compare) {
      mismatch = true;
      reason = `Route beacon region (${active}) ≠ this host (${compare}).`;
    }
  } else {
    if (role && active !== role) {
      mismatch = true;
      reason = `Route beacon endpoint (${active}) ≠ this tier (${role}).`;
    }
  }

  if (!mismatch) {
    cancelRampKillTimer();
    return;
  }

  const onDrTier = declaredTrafficTier() === "dr";
  const hasLoad = explicitMode !== "off" || watchers.length > 0;
  if (!hasLoad) return;

  if (onDrTier) {
    clearSimulation(`${reason} DR tier — cleared any stray CPU helpers.`);
    return;
  }

  const hard = (process.env.STREAMVAULT_FAILOVER_HARD_CLEAR ?? "").trim() === "1";
  if (hard) {
    clearSimulation(`${reason} Traffic left this primary host (hard clear).`);
    return;
  }

  beginGradualRampDown(`${reason} Traffic left this primary host;`);
}

export function ensureTrafficWatch() {
  if (routeWatchInitialized) return;
  if (!process.env.STREAMVAULT_TRAFFIC_REGION_URL?.trim()) return;
  if ((process.env.STREAMVAULT_DISABLE_TRAFFIC_WATCH ?? "").trim() === "1") return;

  routeWatchInitialized = true;
  void evaluateTrafficMismatch();
  const period = Number(process.env.STREAMVAULT_TRAFFIC_WATCH_MS ?? "20000");
  const ms =
    Number.isFinite(period) ? Math.min(120000, Math.max(5000, Math.floor(period))) : 20000;

  const handle = setInterval(() => void evaluateTrafficMismatch(), ms);
  if (typeof handle.unref === "function") {
    handle.unref();
  }
}

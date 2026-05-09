import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/request-user";
import {
  clearSimulation,
  cpuSimulationBlockReason,
  cpuStressSimulationAllowed,
  ensureTrafficWatch,
  setSimulationMode,
  snapshot,
  type SimMode,
} from "@/lib/cpu-load-simulator";

export const dynamic = "force-dynamic";

function parseMode(raw: unknown): SimMode | null {
  if (typeof raw !== "string") return null;
  const m = raw.trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
  if (m === "off" || m === "clear" || m === "none" || m === "normal") return "off";
  if (m === "pre_disaster" || m === "pre") return "pre_disaster";
  if (m === "disaster" || m === "dis") return "disaster";
  return null;
}

function resolveEffectiveMode(snap: ReturnType<typeof snapshot>): string {
  if (snap.rampDownActive && snap.runningWorkers > 0) return "ramping_down";

  let effective: SimMode = snap.explicitMode;
  if (effective === "off" && snap.runningWorkers > 0) {
    const pre =
      typeof process.env.STREAMVAULT_LOAD_WORKERS_PRE !== "undefined"
        ? Number(process.env.STREAMVAULT_LOAD_WORKERS_PRE)
        : 1;
    const dis =
      typeof process.env.STREAMVAULT_LOAD_WORKERS_DISASTER !== "undefined"
        ? Number(process.env.STREAMVAULT_LOAD_WORKERS_DISASTER)
        : 3;
    const preN = Math.max(1, Number.isFinite(pre) ? Math.floor(pre) : 1);
    const disN = Math.max(2, Number.isFinite(dis) ? Math.floor(dis) : 3);
    const split = Math.max(preN + 1, disN - 1);
    effective = snap.runningWorkers >= split ? "disaster" : "pre_disaster";
  }
  return effective;
}

async function assemblePayload() {
  ensureTrafficWatch();

  const snap = snapshot();
  const effectiveMode = resolveEffectiveMode(snap);

  return {
    ok: true as const,
    simulation: snap,
    effectiveMode,
    cpu_helpers_unavailable: snap.explicitMode !== "off" && snap.runningWorkers === 0,
    cpuStressAllowed: cpuStressSimulationAllowed(),
    cpuStressBlockReason: cpuSimulationBlockReason(),
  };
}

export async function GET(req: Request) {
  void req;
  const u = await userFromRequest(req);
  if (!u)
    return NextResponse.json({ ok: false as const, error: "Not authenticated" }, { status: 401 });
  if (u.role !== "admin")
    return NextResponse.json({ ok: false as const, error: "Forbidden" }, { status: 403 });

  ensureTrafficWatch();
  return NextResponse.json(await assemblePayload());
}

export async function POST(req: Request) {
  const u = await userFromRequest(req);
  if (!u)
    return NextResponse.json({ ok: false as const, error: "Not authenticated" }, { status: 401 });
  if (u.role !== "admin")
    return NextResponse.json({ ok: false as const, error: "Forbidden" }, { status: 403 });
  ensureTrafficWatch();

  let mode: SimMode | null = null;
  try {
    const raw = await req.json();
    mode =
      typeof raw?.mode !== "undefined"
        ? parseMode(raw.mode as unknown)
        : typeof raw?.action !== "undefined"
          ? parseMode(raw.action as unknown)
          : null;
  } catch {
    mode = null;
  }

  if (!mode)
    return NextResponse.json(
      {
        ok: false as const,
        error:
          'JSON body missing mode. Example: {"mode":"pre_disaster"} | disaster | off',
      },
      { status: 400 },
    );

  if (mode !== "off" && !cpuStressSimulationAllowed()) {
    return NextResponse.json(
      {
        ok: false as const,
        error: cpuSimulationBlockReason() ?? "CPU simulation not permitted on this tier.",
      },
      { status: 403 },
    );
  }

  if (mode === "off") clearSimulation();
  else setSimulationMode(mode);

  return NextResponse.json({
    ...(await assemblePayload()),
    appliedMode: mode,
  });
}

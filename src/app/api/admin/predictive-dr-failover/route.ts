import { NextResponse } from "next/server";
import { awsCliJson, awsCliQuiet } from "@/lib/aws-cli-json";
import { cpuSimulationBlockReason, cpuStressSimulationAllowed } from "@/lib/cpu-load-simulator";
import {
  PREDICTIVE_DR_FAILOVER_SSM_NAME,
  resolvePredictiveDrFailoverEnabled,
} from "@/lib/predictive-dr-failover-resolve";
import { userFromRequest } from "@/lib/request-user";

export const dynamic = "force-dynamic";

function ssmHome(): string {
  return (
    process.env.STREAMVAULT_SSM_HOME_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    process.env.AWS_DEFAULT_REGION?.trim() ||
    "us-west-2"
  );
}

function predictiveLabDeployed(): boolean {
  return Boolean(process.env.STREAMVAULT_DEMO_PREDICTIVE_LAMBDA?.trim());
}

async function stsOr503() {
  try {
    await awsCliJson(["sts", "get-caller-identity"]);
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stderr?: string };
    console.error("[predictive-dr-failover] STS probe failed:", err.code ?? "(no code)", err.message, err.stderr ?? "");
    const stderr = err.stderr?.trim();
    const hint =
      err.code === "ENOENT"
        ? "Binary not found (ENOENT). Install awscli or set AWS_CLI_EXECUTABLE."
        : stderr
          ? stderr.slice(0, 400)
          : err.message || String(e);
    return NextResponse.json(
      { ok: false, error: `AWS CLI unreachable or not configured. Detail: ${hint}` },
      { status: 503 },
    );
  }
  return null;
}

export async function GET(req: Request) {
  const u = await userFromRequest(req);
  if (!u) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  if (u.role !== "admin") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!cpuStressSimulationAllowed()) {
    return NextResponse.json(
      { ok: false, error: cpuSimulationBlockReason() ?? "Unavailable from this replica." },
      { status: 403 },
    );
  }

  const deployed = predictiveLabDeployed();
  if (!deployed) {
    return NextResponse.json({ ok: true, predictiveLabDeployed: false as const });
  }

  const fail = await stsOr503();
  if (fail) return fail;

  const enabled = await resolvePredictiveDrFailoverEnabled(ssmHome());
  return NextResponse.json({ ok: true, predictiveLabDeployed: true as const, enabled });
}

export async function POST(req: Request) {
  const u = await userFromRequest(req);
  if (!u) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  if (u.role !== "admin") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!cpuStressSimulationAllowed()) {
    return NextResponse.json(
      { ok: false, error: cpuSimulationBlockReason() ?? "Unavailable from this replica." },
      { status: 403 },
    );
  }

  if (!predictiveLabDeployed()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Predictive DR Lambda is not configured on this deployment (Terraform enable_predictive_dr + STREAMVAULT_DEMO_PREDICTIVE_LAMBDA).",
      },
      { status: 400 },
    );
  }

  const fail = await stsOr503();
  if (fail) return fail;

  let enabled: boolean | null = null;
  try {
    const j = (await req.json()) as unknown;
    if (typeof j === "object" && j !== null && typeof (j as { enabled?: unknown }).enabled === "boolean") {
      enabled = (j as { enabled: boolean }).enabled;
    }
  } catch {
    enabled = null;
  }
  if (enabled === null) {
    return NextResponse.json(
      { ok: false, error: 'JSON body must include boolean "enabled".' },
      { status: 400 },
    );
  }

  const home = ssmHome();
  try {
    await awsCliQuiet([
      "--region",
      home,
      "ssm",
      "put-parameter",
      "--name",
      PREDICTIVE_DR_FAILOVER_SSM_NAME,
      "--value",
      enabled ? "1" : "0",
      "--type",
      "String",
      "--overwrite",
    ]);
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : "put-parameter failed (check IAM ssm:PutParameter on parameter/streamvault/demo/*).",
      },
      { status: 503 },
    );
  }

  const resolved = await resolvePredictiveDrFailoverEnabled(home);
  return NextResponse.json({ ok: true, predictiveLabDeployed: true as const, enabled: resolved });
}

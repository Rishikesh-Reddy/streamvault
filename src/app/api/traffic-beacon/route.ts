import { NextResponse } from "next/server";
import { awsCliJson } from "@/lib/aws-cli-json";

export const dynamic = "force-dynamic";

function ssmHome(): string {
  return (
    process.env.STREAMVAULT_SSM_HOME_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    process.env.AWS_DEFAULT_REGION?.trim() ||
    "us-west-2"
  );
}

/** Public beacon for STREAMVAULT_TRAFFIC_REGION_URL — uses SSM in primary region with instance role when on EC2. */
export async function GET() {
  const primaryHint = process.env.STREAMVAULT_PRIMARY_REGION_HINT?.trim() || "";
  const secondaryHint = process.env.STREAMVAULT_SECONDARY_REGION_HINT?.trim() || "";

  try {
    const r = ssmHome();
    const [life, svc] = await Promise.all([
      awsCliJson<{ Parameter?: { Value?: string } }>([
        "--region",
        r,
        "ssm",
        "get-parameter",
        "--name",
        "/streamvault/demo/secondary_lifecycle",
      ]),
      awsCliJson<{ Parameter?: { Value?: string } }>([
        "--region",
        r,
        "ssm",
        "get-parameter",
        "--name",
        "/streamvault/demo/active_serving",
      ]),
    ]);

    const secondaryLifecycle = (life.Parameter?.Value ?? "cold").trim();
    const active = (svc.Parameter?.Value ?? "primary").trim();
    const trafficRegion = active === "secondary" ? secondaryHint : primaryHint;

    return NextResponse.json({
      ok: true,
      trafficRegion,
      secondaryLifecycle,
      activeServing: active,
      role: active === "secondary" ? "secondary" : "primary",
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        trafficRegion: primaryHint,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 503 },
    );
  }
}

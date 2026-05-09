import { NextResponse } from "next/server";
import type { ServingInstanceContext } from "@/lib/ec2-metrics";
import {
  fetchEc2Dashboard,
  fetchServingInstanceContext,
  resolveInstanceId,
} from "@/lib/ec2-metrics";
import { getConfiguredEc2Instances } from "@/lib/ec2-instances-env";
import { userFromRequest } from "@/lib/request-user";

type MetricsTarget = { instanceId: string; region: string };

function normalizeServing(s: ServingInstanceContext): MetricsTarget {
  return { instanceId: s.instanceId, region: s.region };
}

async function resolveMetricsTarget(url: URL, serving: MetricsTarget | null): Promise<MetricsTarget | null> {
  const qId = url.searchParams.get("instanceId")?.trim();
  const qRegion = url.searchParams.get("region")?.trim();
  if (qId && qRegion) return { instanceId: qId, region: qRegion };

  if (serving) return serving;

  const list = getConfiguredEc2Instances();
  if (list.length > 0) return { instanceId: list[0].id, region: list[0].region };

  const fromMeta = await resolveInstanceId();
  const regionGuess = process.env.AWS_REGION?.trim() ?? process.env.AWS_DEFAULT_REGION?.trim();
  if (fromMeta && regionGuess) return { instanceId: fromMeta, region: regionGuess };

  const fixedId = process.env.EC2_INSTANCE_ID?.trim();
  const fixedRg = process.env.AWS_REGION?.trim() ?? process.env.AWS_DEFAULT_REGION?.trim();
  if (fixedId && fixedRg) return { instanceId: fixedId, region: fixedRg };

  return null;
}

export async function GET(req: Request) {
  const u = await userFromRequest(req);
  if (!u) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  if (u.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const h = Number(url.searchParams.get("hours") ?? "3");
  const hours = [1, 3, 6, 12, 24, 48].includes(h) ? h : 3;

  const servingCtx = await fetchServingInstanceContext();
  const serving = servingCtx ? normalizeServing(servingCtx) : null;

  const requestedTarget = await resolveMetricsTarget(url, serving);

  const instancesFromEnv = getConfiguredEc2Instances().map((x) => ({
    instanceId: x.id,
    region: x.region,
    ...(x.label ? { label: x.label } : {}),
  }));

  let instancesPayload = [...instancesFromEnv];
  const servingPayload = servingCtx
    ? {
        instanceId: servingCtx.instanceId,
        region: servingCtx.region,
        ...(servingCtx.availabilityZone ? { availabilityZone: servingCtx.availabilityZone } : {}),
      }
    : null;

  if (
    servingPayload &&
    !instancesPayload.some(
      (x) =>
        x.instanceId === servingPayload.instanceId && x.region === servingPayload.region,
    )
  ) {
    instancesPayload = [
      { instanceId: servingPayload.instanceId, region: servingPayload.region, label: "Current server" },
      ...instancesPayload,
    ];
  }

  if (!requestedTarget) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No EC2 metrics target. Set EC2_INSTANCES_JSON (recommended), or EC2_INSTANCE_ID plus AWS_REGION, or run on EC2 with USE_EC2_METADATA=true.",
      },
      { status: 400 },
    );
  }

  try {
    const data = await fetchEc2Dashboard({
      instanceId: requestedTarget.instanceId,
      hours,
      region: requestedTarget.region,
    });

    return NextResponse.json({
      ok: true,
      hours,
      data,
      serving: servingPayload,
      instances: instancesPayload,
      requestedTarget: {
        instanceId: data.instanceId,
        region: data.region,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

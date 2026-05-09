import { NextResponse } from "next/server";
import { fetchServingInstanceContext } from "@/lib/ec2-metrics";

export const dynamic = "force-dynamic";

/** Optional strip for every page: proves which EC2 (primary vs DR region) is answering. */
export async function GET() {
  const enabled =
    process.env.SHOW_INSTANCE_BANNER === "1" ||
    process.env.NEXT_PUBLIC_SHOW_INSTANCE_BANNER === "1";

  if (!enabled) {
    return NextResponse.json({ ok: true as const, visible: false });
  }

  try {
    const tier =
      process.env.STREAMVAULT_TRAFFIC_ROLE?.trim() ??
      process.env.STREAMVAULT_ENDPOINT_ROLE?.trim() ??
      "";
    const serving = await fetchServingInstanceContext();
    if (!serving) {
      return NextResponse.json({
        ok: true as const,
        visible: true,
        tier: tier || null,
        hint: "USE_EC2_METADATA=1 on EC2 so the app can read serving instance + region.",
      });
    }

    return NextResponse.json({
      ok: true as const,
      visible: true,
      instanceId: serving.instanceId,
      region: serving.region,
      availabilityZone: serving.availabilityZone ?? null,
      tier: tier || null,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false as const,
        visible: true,
        error: e instanceof Error ? e.message : "banner error",
      },
      { status: 500 },
    );
  }
}

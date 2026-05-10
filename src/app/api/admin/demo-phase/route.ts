import { NextResponse } from "next/server";
import {
  awsCliJson,
  awsCliQuiet,
  dualstackAlbDns,
  route53UpsertWeighted,
  waitForHealthyAlbTargets,
} from "@/lib/aws-cli-json";
import {
  cpuSimulationBlockReason,
  cpuStressSimulationAllowed,
  declaredTrafficTier,
} from "@/lib/cpu-load-simulator";
import { userFromRequest } from "@/lib/request-user";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

export const dynamic = "force-dynamic";

type DemoAction = "baseline" | "pre_disaster" | "disaster" | "failback" | "normalize";

type PeerFacts = {
  primary_alb_dns: string;
  primary_hosted_zone_id: string;
  secondary_alb_dns: string;
  secondary_hosted_zone_id: string;
  viewer_fqdn: string;
  hosted_zone_id: string;
  set_id_primary: string;
  set_id_secondary: string;
  baseline_primary_weight?: string;
  baseline_secondary_weight?: string;
  warm_primary_weight?: string;
  warm_secondary_weight?: string;
  fail_primary_weight?: string;
  fail_secondary_weight?: string;
  restored_primary_weight?: string;
  restored_secondary_weight?: string;
  secondary_region: string;
  secondary_instance_id: string;
  secondary_target_group_arn: string;
  predictive_lambda_name?: string;
};

function num(raw: string | undefined, fb: number) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fb;
}

function ssmHome(): string {
  return (
    process.env.STREAMVAULT_SSM_HOME_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    process.env.AWS_DEFAULT_REGION?.trim() ||
    "us-west-2"
  );
}

async function getPeerFacts(): Promise<PeerFacts | null> {
  try {
    const raw = await awsCliJson<{ Parameter?: { Value?: string } }>([
      "--region",
      ssmHome(),
      "ssm",
      "get-parameter",
      "--name",
      "/streamvault/demo/route53_peer_json",
    ]);
    const v = raw.Parameter?.Value;
    if (!v) return null;
    return JSON.parse(v) as PeerFacts;
  } catch {
    return null;
  }
}

async function putParam(name: string, value: string) {
  await awsCliQuiet([
    "--region",
    ssmHome(),
    "ssm",
    "put-parameter",
    "--name",
    name,
    "--value",
    value,
    "--type",
    "String",
    "--overwrite",
  ]);
}

async function ensureDrRunning(peer: PeerFacts): Promise<{ ok: boolean; message?: string }> {
  const r = peer.secondary_region;
  const id = peer.secondary_instance_id;
  try {
    const d = await awsCliJson<{ Reservations?: { Instances?: { State?: { Name?: string } }[] }[] }>([
      "--region",
      r,
      "ec2",
      "describe-instances",
      "--instance-ids",
      id,
    ]);
    const st = d.Reservations?.[0]?.Instances?.[0]?.State?.Name;
    if (st === "terminated" || st === "shutting-down") {
      return {
        ok: false,
        message: `route53_peer_json references ${id} (state: ${st}). Run terraform apply in terraform-streamvault to refresh /streamvault/demo/route53_peer_json with the current aws_instance.app_secondary id.`,
      };
    }
    if (st !== "running" && st !== "pending") {
      await awsCliQuiet(["--region", r, "ec2", "start-instances", "--instance-ids", id]);
    }
    await awsCliQuiet(["--region", r, "ec2", "wait", "instance-running", "--instance-ids", id]);
    const healthy = await waitForHealthyAlbTargets(r, peer.secondary_target_group_arn, 900_000, {
      instanceId: id,
    });
    if (!healthy) return { ok: false, message: "DR EC2 ran but secondary target stayed unhealthy." };
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

async function stopDr(peer: PeerFacts): Promise<{ ok: boolean; message?: string }> {
  try {
    await awsCliQuiet([
      "--region",
      peer.secondary_region,
      "ec2",
      "stop-instances",
      "--instance-ids",
      peer.secondary_instance_id,
    ]);
    await putParam("/streamvault/demo/secondary_lifecycle", "cold");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

function aliasChange(peer: PeerFacts, priW: number, secW: number) {
  const name = `${peer.viewer_fqdn.trim().replace(/\.$/, "")}.`;
  return {
    Comment: "StreamVault demo weighted aliases",
    Changes: [
      {
        Action: "UPSERT",
        ResourceRecordSet: {
          Name: name,
          Type: "A",
          SetIdentifier: peer.set_id_primary,
          Weight: priW,
          AliasTarget: {
            HostedZoneId: peer.primary_hosted_zone_id,
            DNSName: dualstackAlbDns(peer.primary_alb_dns),
            EvaluateTargetHealth: true,
          },
        },
      },
      {
        Action: "UPSERT",
        ResourceRecordSet: {
          Name: name,
          Type: "A",
          SetIdentifier: peer.set_id_secondary,
          Weight: secW,
          AliasTarget: {
            HostedZoneId: peer.secondary_hosted_zone_id,
            DNSName: dualstackAlbDns(peer.secondary_alb_dns),
            EvaluateTargetHealth: true,
          },
        },
      },
    ],
  };
}

async function invokePredictive(region: string, name: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lvout-"));
  const outPath = path.join(dir, "resp.json");
  try {
    await awsCliQuiet([
      "--region",
      region,
      "lambda",
      "invoke",
      "--function-name",
      name,
      "--invocation-type",
      "RequestResponse",
      "--cli-binary-format",
      "raw-in-base64-out",
      "--payload",
      "{}",
      outPath,
    ]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function POST(req: Request) {
  try {
    await awsCliJson(["sts", "get-caller-identity"]);
  } catch {
    return NextResponse.json(
      { ok: false, error: "AWS CLI unreachable (install awscli + grant instance role)." },
      { status: 503 },
    );
  }

  const u = await userFromRequest(req);
  if (!u) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  if (u.role !== "admin") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!cpuStressSimulationAllowed()) {
    return NextResponse.json(
      { ok: false, error: cpuSimulationBlockReason() ?? "Run demo controls from primary region only." },
      { status: 403 },
    );
  }

  let action: DemoAction | null = null;
  try {
    const j = await req.json();
    const raw = typeof j?.action === "string" ? j.action.trim().toLowerCase() : "";
    if (raw === "baseline" || raw === "cold_start" || raw === "reset") action = "baseline";
    else if (raw === "pre_disaster" || raw === "pre" || raw === "warm_dr") action = "pre_disaster";
    else if (raw === "disaster" || raw === "cutover") action = "disaster";
    else if (raw === "failback" || raw === "restore_primary_dns") action = "failback";
    else if (raw === "normalize" || raw === "cold" || raw === "shutdown_dr") action = "normalize";
  } catch {
    action = null;
  }

  if (!action) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'JSON missing action. Expected "baseline"|"pre_disaster"|"disaster"|"failback"|"normalize"',
      },
      { status: 400 },
    );
  }

  const peer = await getPeerFacts();
  if (!peer?.viewer_fqdn?.trim())
    return NextResponse.json({
      ok: false,
      error:
        "Demo SSM incomplete. terraform apply writes /streamvault/demo/route53_peer_json — set dr_route53_record_name and dr_route53_hosted_zone_id.",
    });

  const zone = peer.hosted_zone_id.trim();
  if (!zone)
    return NextResponse.json({
      ok: false,
      error:
        "Hosted zone missing in bundle. Configure dr_route53_hosted_zone_id before using admin demo-phase.",
    });

  const bPri = num(peer.baseline_primary_weight ?? "100", 100);
  const bSec = num(peer.baseline_secondary_weight ?? "0", 0);
  const wPri = num(peer.warm_primary_weight ?? "200", 200);
  const wSec = num(peer.warm_secondary_weight ?? "100", 100);
  const fPri = num(peer.fail_primary_weight ?? "10", 10);
  const fSec = num(peer.fail_secondary_weight ?? "200", 200);
  const rPri = num(peer.restored_primary_weight ?? "200", 200);
  const rSec = num(peer.restored_secondary_weight ?? "100", 100);

  const home = ssmHome();
  const log: Record<string, string | boolean | undefined> = { action };

  try {
    switch (action) {
      case "baseline": {
        await putParam("/streamvault/demo/active_serving", "primary");
        await route53UpsertWeighted(zone, aliasChange(peer, bPri, bSec));
        const st = await stopDr(peer);
        log.stopped_secondary = st.ok;
        log.stop_message = st.message;
        log.route53Weights = `${bPri}/${bSec}`;
        break;
      }
      case "pre_disaster": {
        await putParam("/streamvault/demo/active_serving", "primary");
        const run = await ensureDrRunning(peer);
        log.dr_instance_start = run.ok;
        if (!run.ok) return NextResponse.json({ ok: false, ...log, error: run.message }, { status: 500 });
        await putParam("/streamvault/demo/secondary_lifecycle", "warm");
        await route53UpsertWeighted(zone, aliasChange(peer, wPri, wSec));
        log.route53Weights = `${wPri}/${wSec}`;
        const predict = peer.predictive_lambda_name?.trim();
        if (predict) {
          try {
            await invokePredictive(home, predict);
            log.prediction_lambda_invoked = true;
          } catch {
            log.prediction_lambda_invoked = false;
          }
        }
        break;
      }
      case "disaster": {
        const run = await ensureDrRunning(peer);
        log.dr_health = run.ok;
        if (!run.ok) {
          return NextResponse.json({ ok: false, ...log, error: run.message ?? "Cutover aborted" }, {
            status: 500,
          });
        }
        await putParam("/streamvault/demo/active_serving", "secondary");
        await putParam("/streamvault/demo/secondary_lifecycle", "active");
        await route53UpsertWeighted(zone, aliasChange(peer, fPri, fSec));
        log.route53Weights = `${fPri}/${fSec}`;
        log.activeTrafficAwsRegionHint = peer.secondary_region;
        break;
      }
      case "failback": {
        await putParam("/streamvault/demo/active_serving", "primary");
        await putParam("/streamvault/demo/secondary_lifecycle", "warm");
        await route53UpsertWeighted(zone, aliasChange(peer, rPri, rSec));
        log.route53Weights = `${rPri}/${rSec}`;
        break;
      }
      case "normalize": {
        await putParam("/streamvault/demo/active_serving", "primary");
        await route53UpsertWeighted(zone, aliasChange(peer, bPri, bSec));
        const st = await stopDr(peer);
        log.stopped_secondary = st.ok;
        log.route53Weights = `${bPri}/${bSec}`;
        log.stop_message = st.message;
        break;
      }
    }

    log.tierDeclared = declaredTrafficTier();
    return NextResponse.json({ ok: true, ...log });
  } catch (e) {
    return NextResponse.json(
      { ok: false, action, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

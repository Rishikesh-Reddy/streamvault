/**
 * Thin wrapper around AWS CLI v1/v2 installed on EC2 (instance role credentials).
 */

import { execFile } from "child_process";
import { existsSync } from "fs";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

/** Systemd strips PATH; Ubuntu apt awscli installs to /usr/bin/aws. */
function resolveAwsCli(): string {
  const explicit = process.env.AWS_CLI_EXECUTABLE?.trim();
  if (explicit && existsSync(explicit)) return explicit;
  for (const p of ["/usr/local/bin/aws", "/usr/bin/aws"]) {
    if (existsSync(p)) return p;
  }
  return "aws";
}

const awsBin = resolveAwsCli();

function runAws(args: string[]): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      awsBin,
      args,
      {
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env },
      },
      (err, stdout, stderr) => {
        if (err) {
          reject(Object.assign(err as Error, { stderr }));
          return;
        }
        resolve({ stdout });
      },
    );
  });
}

/** Args after `aws`, e.g. ["ssm", "get-parameter", "--name", "/x"]. */
export async function awsCliJson<T>(segments: readonly string[]): Promise<T> {
  const { stdout } = await runAws([...segments, "--output", "json", "--no-cli-pager"]);
  return JSON.parse(stdout) as T;
}

export async function awsCliQuiet(segments: readonly string[]): Promise<void> {
  await runAws([...segments, "--no-cli-pager"]);
}

export async function writeTempJsonFile(obj: unknown): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "svdemo-"));
  const p = path.join(dir, "batch.json");
  await fs.writeFile(p, JSON.stringify(obj), "utf8");
  return p;
}

export async function route53UpsertWeighted(
  hostedZoneId: string,
  batch: unknown,
): Promise<{ ChangeInfo?: { Id?: string } }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "svr53-"));
  const p = path.join(dir, "change.json");
  await fs.writeFile(p, typeof batch === "string" ? batch : JSON.stringify(batch), "utf8");
  try {
    return await awsCliJson<{ ChangeInfo?: { Id?: string } }>([
      "route53",
      "change-resource-record-sets",
      "--hosted-zone-id",
      hostedZoneId,
      "--change-batch",
      `file://${p}`,
    ]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

export function dualstackAlbDns(dns: string): string {
  const x = dns.trim();
  return x.startsWith("dualstack.") ? x : `dualstack.${x}`;
}

export async function waitForHealthyAlbTargets(
  region: string,
  tgArn: string,
  timeoutMs = 900_000,
  opts?: { instanceId?: string },
): Promise<boolean> {
  const wantId = opts?.instanceId?.trim();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const out = await awsCliJson<{
      TargetHealthDescriptions?: {
        Target?: { Id?: string; Port?: number };
        TargetHealth?: { State?: string };
      }[];
    }>(["--region", region, "elbv2", "describe-target-health", "--target-group-arn", tgArn]);
    const list = out.TargetHealthDescriptions ?? [];
    const scoped = wantId ? list.filter((d) => d.Target?.Id === wantId) : list;
    const anyHealthy = scoped.some((d) => d.TargetHealth?.State === "healthy");
    if (anyHealthy) return true;
    await new Promise((r) => setTimeout(r, 10000));
  }
  return false;
}

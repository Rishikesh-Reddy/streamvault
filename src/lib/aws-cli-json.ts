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

/**
 * Next/dotenv often sets AWS_* keys to empty strings. The CLI credential chain
 * treats those as "use env provider" and fails on EC2 instead of falling through
 * to the instance role (while `aws` in a minimal shell env still works).
 */
function envForAwsCli(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const stripIfBlank = (k: string) => {
    const v = env[k];
    if (v !== undefined && String(v).trim() === "") delete env[k];
  };
  for (const k of [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "AWS_SECURITY_TOKEN",
    "AWS_REGION",
    "AWS_DEFAULT_REGION",
    "AWS_PROFILE",
    "AWS_DEFAULT_PROFILE",
  ]) {
    stripIfBlank(k);
  }
  // CLI v1 (Ubuntu `awscli` package) does not support `--no-cli-pager` (v2-only). Disabling
  // the pager via env works for v1 and v2 and avoids blocking on `less` under execFile.
  env.AWS_PAGER = "";
  return env;
}

function runAws(args: string[]): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    const bin = resolveAwsCli();
    execFile(
      bin,
      args,
      {
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
        env: envForAwsCli(),
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
  const { stdout } = await runAws([...segments, "--output", "json"]);
  const trimmed = stdout.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`AWS CLI JSON parse failed (${msg}). stdout (first 240 chars): ${trimmed.slice(0, 240)}`);
  }
}

export async function awsCliQuiet(segments: readonly string[]): Promise<void> {
  await runAws(segments);
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

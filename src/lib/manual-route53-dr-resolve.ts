import { awsCliJson } from "@/lib/aws-cli-json";
import { manualRoute53DrFromAdminEnabled, parseManualRoute53DrToggle } from "@/lib/manual-dr-route53-flag";

/** Writable from admin UI; seeded by Terraform */
export const MANUAL_ROUTE53_DR_SSM_NAME = "/streamvault/demo/manual_route53_dr_enabled";

/**
 * Prefer SSM `/streamvault/demo/manual_route53_dr_enabled` when present; else bootstrap env only.
 */
export async function resolveManualRoute53DrFromAdmin(ssmHomeRegion: string): Promise<boolean> {
  try {
    const raw = await awsCliJson<{ Parameter?: { Value?: string } }>([
      "--region",
      ssmHomeRegion,
      "ssm",
      "get-parameter",
      "--name",
      MANUAL_ROUTE53_DR_SSM_NAME,
    ]);
    const v = raw.Parameter?.Value;
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return parseManualRoute53DrToggle(v);
    }
  } catch {
    /* ParameterNotFound or CLI — env default */
  }
  return manualRoute53DrFromAdminEnabled();
}

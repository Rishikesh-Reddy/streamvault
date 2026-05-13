import { awsCliJson } from "@/lib/aws-cli-json";
import { parseManualRoute53DrToggle, predictiveDrFailoverFromEnv } from "@/lib/manual-dr-route53-flag";

export const PREDICTIVE_DR_FAILOVER_SSM_NAME = "/streamvault/demo/predictive_dr_failover_enabled";

export async function resolvePredictiveDrFailoverEnabled(ssmHomeRegion: string): Promise<boolean> {
  try {
    const raw = await awsCliJson<{ Parameter?: { Value?: string } }>([
      "--region",
      ssmHomeRegion,
      "ssm",
      "get-parameter",
      "--name",
      PREDICTIVE_DR_FAILOVER_SSM_NAME,
    ]);
    const v = raw.Parameter?.Value;
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return parseManualRoute53DrToggle(v);
    }
  } catch {
    /* no param → env default */
  }
  return predictiveDrFailoverFromEnv();
}

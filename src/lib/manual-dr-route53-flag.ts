/**
 * Parse "1"|"true"|"on"|… vs "0"|"off"|… Defaults to enabled when ambiguous or unset.
 *
 * Prefer **resolveManualRoute53DrFromAdmin** (SSM + env fallback); this is env-only bootstrap.
 */
export function parseManualRoute53DrToggle(raw: string | undefined | null): boolean {
  if (raw === undefined || raw === null) return true;
  const v = String(raw).trim().toLowerCase();
  if (v === "") return true;
  if (["0", "false", "no", "off", "disabled"].includes(v)) return false;
  return true;
}

/** Env-only bootstrap when SSM `/streamvault/demo/manual_route53_dr_enabled` is missing (see STREAMVAULT_MANUAL_ROUTE53_DR_ENABLED). */
export function manualRoute53DrFromAdminEnabled(): boolean {
  return parseManualRoute53DrToggle(process.env.STREAMVAULT_MANUAL_ROUTE53_DR_ENABLED);
}

/** Scheduled predictive DR Lambda respects SSM; env fallback before first apply (STREAMVAULT_PREDICTIVE_DR_FAILOVER_ENABLED). */
export function predictiveDrFailoverFromEnv(): boolean {
  return parseManualRoute53DrToggle(process.env.STREAMVAULT_PREDICTIVE_DR_FAILOVER_ENABLED);
}

/** EC2 instances registered for admin metrics (`EC2_INSTANCES_JSON` in .env). */

export type Ec2InstanceRef = {
  id: string;
  region: string;
  label?: string;
};

function parseEc2InstancesJson(raw: string): Ec2InstanceRef[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: Ec2InstanceRef[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id.trim() : "";
      const region = typeof r.region === "string" ? r.region.trim() : "";
      const label = typeof r.label === "string" ? r.label.trim() : undefined;
      if (id && region) out.push({ id, region, ...(label ? { label } : {}) });
    }
    return out;
  } catch {
    return [];
  }
}

export function getConfiguredEc2Instances(): Ec2InstanceRef[] {
  const raw = process.env.EC2_INSTANCES_JSON?.trim();
  return raw ? parseEc2InstancesJson(raw) : [];
}

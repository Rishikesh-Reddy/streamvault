import { CloudWatchClient, GetMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { DescribeInstancesCommand, EC2Client } from "@aws-sdk/client-ec2";

export type MetricPoint = { t: string; v: number };

export type Ec2DashboardData = {
  instanceId: string;
  region: string;
  availabilityZone?: string;
  instanceType?: string;
  state?: string;
  launchTime?: string;
  metricsUnavailable?: string;
  cpuPercent: MetricPoint[];
  networkInBytes: MetricPoint[];
  networkOutBytes: MetricPoint[];
  diskReadBytes?: MetricPoint[];
  diskWriteBytes?: MetricPoint[];
  /** Latest averages / sums for header cards */
  summary: {
    cpuLatest: number | null;
    networkInLast5mAvgBytes: number | null;
    networkOutLast5mAvgBytes: number | null;
  };
};

const METADATA_BASE = "http://169.254.169.254";

async function imdsRequest(path: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(`${METADATA_BASE}${path}`, {
      headers: { "X-aws-ec2-metadata-token": token },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchImdsV2Token(): Promise<string | null> {
  try {
    const tokenRes = await fetch(`${METADATA_BASE}/latest/api/token`, {
      method: "PUT",
      headers: { "X-aws-ec2-metadata-token-ttl-seconds": "21600" },
      signal: AbortSignal.timeout(2000),
    });
    if (!tokenRes.ok) return null;
    const token = (await tokenRes.text()).trim();
    return token || null;
  } catch {
    return null;
  }
}

/** IMDSv2 token, then instance id (only works when this process runs on EC2). */
export async function fetchInstanceIdFromMetadata(): Promise<string | null> {
  try {
    const token = await fetchImdsV2Token();
    if (!token) return null;
    const id = await imdsRequest("/latest/meta-data/instance-id", token);
    return id?.trim() || null;
  } catch {
    return null;
  }
}

export type ServingInstanceContext = {
  instanceId: string;
  region: string;
  availabilityZone?: string;
};

/**
 * Identify the EC2 that is running this Node process (for "which instance is serving" in admin).
 */
export async function fetchServingInstanceContext(): Promise<ServingInstanceContext | null> {
  const useMeta = process.env.USE_EC2_METADATA === "true" || process.env.USE_EC2_METADATA === "1";
  if (!useMeta) return null;
  try {
    const token = await fetchImdsV2Token();
    if (!token) return null;
    const docRaw = await imdsRequest("/latest/dynamic/instance-identity/document", token);
    if (!docRaw) return null;
    const doc = JSON.parse(docRaw) as {
      instanceId?: string;
      region?: string;
      availabilityZone?: string;
    };
    const instanceId = typeof doc.instanceId === "string" ? doc.instanceId.trim() : "";
    const region = typeof doc.region === "string" ? doc.region.trim() : "";
    if (!instanceId || !region) return null;
    const availabilityZone =
      typeof doc.availabilityZone === "string" ? doc.availabilityZone.trim() : undefined;
    return {
      instanceId,
      region,
      ...(availabilityZone ? { availabilityZone } : {}),
    };
  } catch {
    return null;
  }
}

export async function resolveInstanceId(): Promise<string | null> {
  const fromEnv = process.env.EC2_INSTANCE_ID?.trim();
  if (fromEnv) return fromEnv;

  const useMeta = process.env.USE_EC2_METADATA === "true" || process.env.USE_EC2_METADATA === "1";
  if (!useMeta) return null;

  return fetchInstanceIdFromMetadata();
}

function clientRegion(): string {
  return process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
}

function dimension(instanceId: string) {
  return [{ Name: "InstanceId" as const, Value: instanceId }];
}

/** One batched CloudWatch call — default EC2 namespace (no custom metrics cost). */
export async function fetchEc2Dashboard(opts: {
  instanceId: string;
  hours: number;
  /** CloudWatch APIs are regional; omit to use AWS_REGION / default. */
  region?: string;
}): Promise<Ec2DashboardData> {
  const region = opts.region ?? clientRegion();
  const instanceId = opts.instanceId;
  const end = new Date();
  const start = new Date(end.getTime() - opts.hours * 3600_000);

  const cw = new CloudWatchClient({ region });
  const ec2 = new EC2Client({ region });

  let instanceType: string | undefined;
  let state: string | undefined;
  let launchTime: string | undefined;
  let availabilityZone: string | undefined;

  try {
    const desc = await ec2.send(
      new DescribeInstancesCommand({ InstanceIds: [instanceId] })
    );
    const inst = desc.Reservations?.[0]?.Instances?.[0];
    instanceType = inst?.InstanceType;
    state = inst?.State?.Name;
    launchTime = inst?.LaunchTime?.toISOString();
    availabilityZone = inst?.Placement?.AvailabilityZone;
  } catch {
    /* DescribeInstances may fail with wrong id / permissions — metrics may still work */
  }

  const period = 300;
  const dim = dimension(instanceId);

  const cmd = new GetMetricDataCommand({
    StartTime: start,
    EndTime: end,
    MetricDataQueries: [
      {
        Id: "cpu",
        MetricStat: {
          Metric: {
            Namespace: "AWS/EC2",
            MetricName: "CPUUtilization",
            Dimensions: dim,
          },
          Period: period,
          Stat: "Average",
        },
        ReturnData: true,
      },
      {
        Id: "netin",
        MetricStat: {
          Metric: {
            Namespace: "AWS/EC2",
            MetricName: "NetworkIn",
            Dimensions: dim,
          },
          Period: period,
          Stat: "Sum",
        },
        ReturnData: true,
      },
      {
        Id: "netout",
        MetricStat: {
          Metric: {
            Namespace: "AWS/EC2",
            MetricName: "NetworkOut",
            Dimensions: dim,
          },
          Period: period,
          Stat: "Sum",
        },
        ReturnData: true,
      },
      {
        Id: "dread",
        MetricStat: {
          Metric: {
            Namespace: "AWS/EC2",
            MetricName: "DiskReadBytes",
            Dimensions: dim,
          },
          Period: period,
          Stat: "Sum",
        },
        ReturnData: true,
      },
      {
        Id: "dwrite",
        MetricStat: {
          Metric: {
            Namespace: "AWS/EC2",
            MetricName: "DiskWriteBytes",
            Dimensions: dim,
          },
          Period: period,
          Stat: "Sum",
        },
        ReturnData: true,
      },
    ],
  });

  const raw = await cw.send(cmd);
  let metricsUnavailable: string | undefined;

  const byId = Object.fromEntries(
    (raw.MetricDataResults ?? []).map((r) => [r.Id, r])
  ) as Record<
    string,
    { Timestamps?: Date[]; Values?: number[] } | undefined
  >;

  function series(id: string): MetricPoint[] {
    const r = byId[id];
    if (!r?.Timestamps?.length || !r.Values?.length) return [];
    return r.Timestamps.map((t, i) => ({
      t: t.toISOString(),
      v: r.Values?.[i] ?? 0,
    }));
  }

  if (raw.MetricDataResults?.length === 0 || !byId.cpu) {
    metricsUnavailable =
      "No CloudWatch points returned. Enable detailed monitoring or wait for data; check IAM (cloudwatch:GetMetricData) and instance ID.";
  }

  const cpu = series("cpu");
  const networkInBytes = series("netin");
  const networkOutBytes = series("netout");
  const diskReadBytes = series("dread");
  const diskWriteBytes = series("dwrite");

  const last = (arr: MetricPoint[]) => (arr.length ? arr[arr.length - 1].v : null);

  return {
    instanceId,
    region,
    availabilityZone,
    instanceType,
    state,
    launchTime,
    metricsUnavailable,
    cpuPercent: cpu,
    networkInBytes,
    networkOutBytes,
    diskReadBytes: diskReadBytes.length ? diskReadBytes : undefined,
    diskWriteBytes: diskWriteBytes.length ? diskWriteBytes : undefined,
    summary: {
      cpuLatest: last(cpu),
      networkInLast5mAvgBytes: last(networkInBytes),
      networkOutLast5mAvgBytes: last(networkOutBytes),
    },
  };
}

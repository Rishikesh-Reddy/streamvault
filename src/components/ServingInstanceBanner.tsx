"use client";

import { useEffect, useState } from "react";

type Banner = {
  visible: boolean;
  instanceId?: string;
  region?: string;
  availabilityZone?: string | null;
  tier?: string | null;
  hint?: string;
  error?: string;
};

export function ServingInstanceBanner() {
  const [b, setB] = useState<Banner | null>(null);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SHOW_INSTANCE_BANNER !== "1") return;

    const run = async () => {
      try {
        const res = await fetch("/api/instance-banner", { cache: "no-store" });
        const j = (await res.json()) as Banner & { ok?: boolean };
        if (!res.ok) setB({ visible: false });
        else setB(j);
      } catch {
        setB(null);
      }
    };
    void run();
  }, []);

  if (process.env.NEXT_PUBLIC_SHOW_INSTANCE_BANNER !== "1" || !b?.visible) return null;

  const label = b.error
    ? `Instance banner: ${b.error}`
    : b.hint
      ? b.hint
      : `${b.tier ? `Tier ${b.tier} · ` : ""}${b.region ?? "?"} · ${b.instanceId ?? "instance ?"}${
          b.availabilityZone ? ` (${b.availabilityZone})` : ""
        }`;

  return (
    <p className="text-sv-muted max-w-3xl px-4 text-center font-mono text-[11px] tracking-tight lg:mx-auto">
      <span className="text-sv-dim uppercase">Serving</span> {label}
    </p>
  );
}

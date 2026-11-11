import type { Metadata } from "next";

import { ZoneDetails } from "@/components/zones/ZoneDetails";

export const metadata: Metadata = { title: "Hosted zone details" };

export default async function HostedZonePage({
  params,
}: PageProps<"/route53/v2/hostedzones/[id]">) {
  const { id } = await params;
  return <ZoneDetails zoneId={decodeURIComponent(id)} />;
}

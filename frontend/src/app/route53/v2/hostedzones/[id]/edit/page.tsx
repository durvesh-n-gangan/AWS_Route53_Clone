import type { Metadata } from "next";

import { EditZone } from "@/components/zones/EditZone";

export const metadata: Metadata = { title: "Edit hosted zone" };

export default async function EditHostedZonePage({
  params,
}: PageProps<"/route53/v2/hostedzones/[id]/edit">) {
  const { id } = await params;
  return <EditZone zoneId={decodeURIComponent(id)} />;
}

import type { Metadata } from "next";

import { CreateRecords } from "@/components/records/CreateRecords";

export const metadata: Metadata = { title: "Create record" };

export default async function CreateRecordPage({
  params,
}: PageProps<"/route53/v2/hostedzones/[id]/records/create">) {
  const { id } = await params;
  return <CreateRecords zoneId={decodeURIComponent(id)} />;
}

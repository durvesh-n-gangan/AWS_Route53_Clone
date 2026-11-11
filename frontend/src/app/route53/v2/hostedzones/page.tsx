import type { Metadata } from "next";

import { ClientOnly } from "@/components/common/ClientOnly";
import { ZonesTable } from "@/components/zones/ZonesTable";

export const metadata: Metadata = { title: "Hosted zones" };

export default function HostedZonesPage() {
  return (
    <ClientOnly>
      <ZonesTable />
    </ClientOnly>
  );
}

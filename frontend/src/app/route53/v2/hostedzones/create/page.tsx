import type { Metadata } from "next";

import { ZoneForm } from "@/components/zones/ZoneForm";

export const metadata: Metadata = { title: "Create hosted zone" };

export default function CreateHostedZonePage() {
  return <ZoneForm mode="create" />;
}

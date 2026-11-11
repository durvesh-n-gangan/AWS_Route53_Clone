"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Spinner from "@cloudscape-design/components/spinner";

import { useBreadcrumbLabel } from "@/components/layout/ShellContext";
import { ZoneForm } from "@/components/zones/ZoneForm";
import { errorMessage } from "@/lib/apiErrors";
import { displayName } from "@/lib/format";
import { useZone } from "@/lib/queries/zones";

/** Loads the zone, then shows the shared zone form in edit mode. */
export function EditZone({ zoneId }: { zoneId: string }) {
  const zone = useZone(zoneId);
  useBreadcrumbLabel(zoneId, zone.data ? displayName(zone.data.name) : undefined);

  if (zone.isPending) {
    return (
      <Box textAlign="center" padding="xxl">
        <Spinner size="large" />
      </Box>
    );
  }
  if (zone.isError) {
    return (
      <Alert type="error" header="Couldn't load hosted zone">
        {errorMessage(zone.error)}
      </Alert>
    );
  }
  // key: re-initialise the form state if the zone ever changes underneath it.
  return <ZoneForm key={zone.data.updated_at} mode="edit" zone={zone.data} />;
}

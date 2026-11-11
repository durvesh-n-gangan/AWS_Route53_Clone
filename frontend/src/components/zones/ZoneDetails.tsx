"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import CopyToClipboard from "@cloudscape-design/components/copy-to-clipboard";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import Table from "@cloudscape-design/components/table";
import Tabs from "@cloudscape-design/components/tabs";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { InfoLink } from "@/components/common/InfoLink";
import { useBreadcrumbLabel } from "@/components/layout/ShellContext";
import { DeleteZoneModal } from "@/components/zones/DeleteZoneModal";
import { HostedZonesHelp } from "@/components/zones/zoneHelp";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/apiErrors";
import { displayName, formatZoneType, orDash } from "@/lib/format";
import { ROUTES } from "@/lib/navigation";
import { useZone } from "@/lib/queries/zones";
import type { HostedZone } from "@/types/api";

function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Box variant="awsui-key-label">{label}</Box>
      <div>{children}</div>
    </div>
  );
}

function ZoneDetailsSection({ zone, onEdit }: { zone: HostedZone; onEdit: () => void }) {
  return (
    <ExpandableSection
      variant="container"
      defaultExpanded
      headerText="Hosted zone details"
      headerActions={<Button onClick={onEdit}>Edit hosted zone</Button>}
    >
      <ColumnLayout columns={3} variant="text-grid">
        <SpaceBetween size="l">
          <KeyValue label="Hosted zone name">{displayName(zone.name)}</KeyValue>
          <KeyValue label="Hosted zone ID">
            <CopyToClipboard
              variant="inline"
              textToCopy={zone.id}
              copyButtonAriaLabel="Copy hosted zone ID"
              copySuccessText="Hosted zone ID copied"
              copyErrorText="Hosted zone ID failed to copy"
            />
          </KeyValue>
          <KeyValue label="Description">{orDash(zone.comment)}</KeyValue>
        </SpaceBetween>
        <SpaceBetween size="l">
          <KeyValue label="Type">{formatZoneType(zone.type)} hosted zone</KeyValue>
          <KeyValue label="Record count">{zone.record_count}</KeyValue>
          <KeyValue label="Query log">-</KeyValue>
          {zone.type === "private" && (
            <KeyValue label="VPCs">
              {zone.vpcs.map((vpc) => (
                <div key={`${vpc.region}/${vpc.vpc_id}`}>
                  {vpc.vpc_id} ({vpc.region})
                </div>
              ))}
            </KeyValue>
          )}
        </SpaceBetween>
        <KeyValue label="Name servers">
          {zone.name_servers.length === 0
            ? "-"
            : zone.name_servers.map((server) => <div key={server}>{server}</div>)}
        </KeyValue>
      </ColumnLayout>
    </ExpandableSection>
  );
}

function TagsTab({ zone, onManage }: { zone: HostedZone; onManage: () => void }) {
  return (
    <Table
      items={zone.tags}
      trackBy="key"
      variant="borderless"
      columnDefinitions={[
        { id: "key", header: "Key", cell: (tag) => tag.key },
        { id: "value", header: "Value", cell: (tag) => orDash(tag.value) },
      ]}
      header={
        <Header
          counter={`(${zone.tags.length})`}
          actions={<Button onClick={onManage}>Manage tags</Button>}
          description="Tags help you organize and identify hosted zones."
        >
          Hosted zone tags
        </Header>
      }
      empty={
        <Box textAlign="center" color="inherit">
          <b>No tags</b>
          <Box variant="p" color="inherit">
            No tags are associated with this hosted zone.
          </Box>
        </Box>
      }
    />
  );
}

interface ZoneDetailsProps {
  zoneId: string;
  /** The Records tab content (added by the records feature). */
  recordsTab?: (zone: HostedZone) => ReactNode;
}

export function ZoneDetails({ zoneId, recordsTab }: ZoneDetailsProps) {
  const router = useRouter();
  const zoneQuery = useZone(zoneId);
  const zone = zoneQuery.data;
  const [deleting, setDeleting] = useState(false);
  useBreadcrumbLabel(zoneId, zone ? displayName(zone.name) : undefined);

  if (zoneQuery.isPending) {
    return (
      <Box textAlign="center" padding="xxl">
        <Spinner size="large" /> <Box variant="span">Loading hosted zone</Box>
      </Box>
    );
  }

  if (zoneQuery.isError || !zone) {
    const notFound = zoneQuery.error instanceof ApiError && zoneQuery.error.status === 404;
    return (
      <ContentLayout header={<Header variant="h1">{zoneId}</Header>}>
        <Alert
          type="error"
          header={notFound ? "Hosted zone not found" : "Couldn't load hosted zone"}
          action={<Button onClick={() => router.push(ROUTES.hostedZones)}>View hosted zones</Button>}
        >
          {errorMessage(zoneQuery.error)}
        </Alert>
      </ContentLayout>
    );
  }

  const editZone = () => router.push(ROUTES.editHostedZone(zone.id));

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          info={<InfoLink topic="hosted zones" help={<HostedZonesHelp />} />}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={() => setDeleting(true)}>Delete zone</Button>
              <Button disabled>Test record</Button>
              <Button disabled>Configure query logging</Button>
            </SpaceBetween>
          }
        >
          {displayName(zone.name)}
        </Header>
      }
    >
      <SpaceBetween size="l">
        <ZoneDetailsSection zone={zone} onEdit={editZone} />
        <Tabs
          ariaLabel="Hosted zone"
          tabs={[
            {
              id: "records",
              label: `Records (${zone.record_count})`,
              content: recordsTab ? (
                recordsTab(zone)
              ) : (
                <Container>
                  <Box color="text-body-secondary">Records are listed here.</Box>
                </Container>
              ),
            },
            {
              id: "dnssec",
              label: "DNSSEC signing",
              content: (
                <Container header={<Header variant="h2">DNSSEC signing</Header>}>
                  <Box color="text-body-secondary">
                    DNSSEC signing is not available in this demo console.
                  </Box>
                </Container>
              ),
            },
            {
              id: "tags",
              label: `Hosted zone tags (${zone.tags.length})`,
              content: <TagsTab zone={zone} onManage={editZone} />,
            },
          ]}
        />
      </SpaceBetween>
      <DeleteZoneModal
        zone={deleting ? zone : null}
        onDismiss={() => setDeleting(false)}
        onDeleted={() => router.push(ROUTES.hostedZones)}
      />
    </ContentLayout>
  );
}

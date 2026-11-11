"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import CopyToClipboard from "@cloudscape-design/components/copy-to-clipboard";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useState, type ReactNode } from "react";

import { EditRecordPanel } from "@/components/records/EditRecordPanel";
import { displayName } from "@/lib/format";
import type { RecordSet } from "@/types/api";

function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Box variant="awsui-key-label">{label}</Box>
      <div>{children}</div>
    </div>
  );
}

interface RecordPanelProps {
  zoneId: string;
  zoneName: string;
  record: RecordSet;
  onClose: () => void;
}

/** Split-panel content: the record's details, with "Edit record" switching to the form. */
export function RecordPanel({ zoneId, zoneName, record, onClose }: RecordPanelProps) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <EditRecordPanel
        zoneId={zoneId}
        zoneName={zoneName}
        record={record}
        onDone={onClose}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <SpaceBetween size="l">
      <Box float="right">
        <Button onClick={() => setEditing(true)}>Edit record</Button>
      </Box>
      <ColumnLayout columns={2} variant="text-grid">
        <SpaceBetween size="l">
          <KeyValue label="Record name">{displayName(record.name)}</KeyValue>
          <KeyValue label="Record type">{record.type}</KeyValue>
          <KeyValue label="Value">
            {record.values.map((value, index) => (
              <div key={`${index}-${value}`}>{value}</div>
            ))}
          </KeyValue>
          <KeyValue label="Alias">No</KeyValue>
        </SpaceBetween>
        <SpaceBetween size="l">
          <KeyValue label="TTL (seconds)">{record.ttl}</KeyValue>
          <KeyValue label="Routing policy">Simple</KeyValue>
          <KeyValue label="Record ID">
            <CopyToClipboard
              variant="inline"
              textToCopy={record.id}
              copyButtonAriaLabel="Copy record ID"
              copySuccessText="Record ID copied"
              copyErrorText="Record ID failed to copy"
            />
          </KeyValue>
        </SpaceBetween>
      </ColumnLayout>
    </SpaceBetween>
  );
}

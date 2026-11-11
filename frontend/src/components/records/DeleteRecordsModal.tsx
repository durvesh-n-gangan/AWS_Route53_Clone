"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";

import { useFlash } from "@/components/common/FlashProvider";
import { displayName } from "@/lib/format";
import { useDeleteRecords } from "@/lib/queries/records";
import type { RecordSet } from "@/types/api";

interface DeleteRecordsModalProps {
  zoneId: string;
  records: RecordSet[];
  onDismiss: () => void;
  onDeleted: () => void;
}

export function DeleteRecordsModal({ zoneId, records, onDismiss, onDeleted }: DeleteRecordsModalProps) {
  const deleteRecords = useDeleteRecords(zoneId);
  const { addFlash } = useFlash();
  if (records.length === 0) return null;

  const defaults = records.filter((record) => record.is_default);
  const noun = records.length === 1 ? "record" : "records";

  const onConfirm = () => {
    deleteRecords.mutate(
      records.map((record) => record.id),
      {
        onSuccess: ({ deleted, failed }) => {
          if (deleted.length > 0) {
            addFlash({
              type: "success",
              content: `Successfully deleted ${deleted.length} ${deleted.length === 1 ? "record" : "records"}.`,
            });
          }
          if (failed.length > 0) {
            addFlash({
              type: "error",
              header: `${failed.length} ${failed.length === 1 ? "record" : "records"} couldn't be deleted`,
              content: failed[0].message,
            });
          }
          onDismiss();
          onDeleted();
        },
      },
    );
  };

  return (
    <Modal
      visible
      onDismiss={onDismiss}
      header={`Delete ${noun}`}
      closeAriaLabel="Close dialog"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={onConfirm}
              disabled={defaults.length > 0}
              loading={deleteRecords.isPending}
            >
              Delete
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        {defaults.length > 0 ? (
          <Alert type="error" header="Default records can't be deleted">
            The NS and SOA records that were created with the hosted zone are required. Clear them
            from your selection to delete the other records.
          </Alert>
        ) : (
          <Box variant="p">
            Are you sure that you want to delete the following {noun}? You can&apos;t undo this
            action.
          </Box>
        )}
        <ul aria-label="Records to delete">
          {records.map((record) => (
            <li key={record.id}>
              <Box variant="strong">{displayName(record.name)}</Box> ({record.type})
            </li>
          ))}
        </ul>
      </SpaceBetween>
    </Modal>
  );
}

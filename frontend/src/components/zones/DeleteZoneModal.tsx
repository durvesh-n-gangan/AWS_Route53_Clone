"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useState } from "react";

import { useFlash } from "@/components/common/FlashProvider";
import { errorMessage } from "@/lib/apiErrors";
import { displayName } from "@/lib/format";
import { useDeleteZone } from "@/lib/queries/zones";
import type { HostedZoneSummary } from "@/types/api";

const CONFIRM_WORD = "delete";

interface DeleteZoneModalProps {
  zone: Pick<HostedZoneSummary, "id" | "name"> | null;
  onDismiss: () => void;
  onDeleted?: () => void;
}

/** Renders nothing until a zone is chosen; remounts per zone so every opening starts clean. */
export function DeleteZoneModal({ zone, onDismiss, onDeleted }: DeleteZoneModalProps) {
  if (!zone) return null;
  return <DeleteZoneDialog key={zone.id} zone={zone} onDismiss={onDismiss} onDeleted={onDeleted} />;
}

function DeleteZoneDialog({
  zone,
  onDismiss,
  onDeleted,
}: DeleteZoneModalProps & { zone: NonNullable<DeleteZoneModalProps["zone"]> }) {
  const [confirmText, setConfirmText] = useState("");
  const deleteZone = useDeleteZone();
  const { addFlash } = useFlash();
  const name = displayName(zone.name);

  const onConfirm = () => {
    deleteZone.mutate(zone.id, {
      onSuccess: () => {
        addFlash({ type: "success", content: `Hosted zone ${name} was deleted successfully.` });
        onDismiss();
        onDeleted?.();
      },
    });
  };

  return (
    <Modal
      visible
      onDismiss={onDismiss}
      header={`Delete ${name}?`}
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
              disabled={confirmText !== CONFIRM_WORD}
              loading={deleteZone.isPending}
            >
              Delete
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <Box variant="span">
          Permanently delete hosted zone <Box variant="strong">{name}</Box>? You can&apos;t undo
          this action.
        </Box>
        <Alert type="warning">
          You can delete a hosted zone only when it contains just its default NS and SOA records.
        </Alert>
        {deleteZone.isError && (
          <Alert type="error" header="Couldn't delete hosted zone">
            {errorMessage(deleteZone.error)}
          </Alert>
        )}
        <FormField label={`To confirm deletion, type "${CONFIRM_WORD}" in the field.`}>
          <Input
            value={confirmText}
            placeholder={CONFIRM_WORD}
            ariaLabel="Confirm deletion"
            onChange={({ detail }) => setConfirmText(detail.value)}
          />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
}

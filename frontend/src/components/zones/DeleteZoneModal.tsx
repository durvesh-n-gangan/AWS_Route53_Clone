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
import { bulkDeleteFlashes } from "@/lib/bulkFlash";
import { displayName } from "@/lib/format";
import { useDeleteZones } from "@/lib/queries/zones";
import type { HostedZoneSummary } from "@/types/api";

const CONFIRM_WORD = "delete";

type ZoneRef = Pick<HostedZoneSummary, "id" | "name">;

interface DeleteZoneModalProps {
  /** The zones to delete; an empty list keeps the modal closed. */
  zones: ZoneRef[];
  onDismiss: () => void;
  /** Called with the IDs that were actually deleted. */
  onDeleted?: (deletedIds: string[]) => void;
}

/** Remounts per selection so every opening starts with an empty confirmation field. */
export function DeleteZoneModal({ zones, onDismiss, onDeleted }: DeleteZoneModalProps) {
  if (zones.length === 0) return null;
  return (
    <DeleteZoneDialog
      key={zones.map((zone) => zone.id).join(",")}
      zones={zones}
      onDismiss={onDismiss}
      onDeleted={onDeleted}
    />
  );
}

function DeleteZoneDialog({ zones, onDismiss, onDeleted }: DeleteZoneModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const deleteZones = useDeleteZones();
  const { addFlash } = useFlash();
  const names = new Map(zones.map((zone) => [zone.id, displayName(zone.name)]));
  const single = zones.length === 1 ? displayName(zones[0].name) : null;

  const onConfirm = () => {
    setInlineError(null);
    deleteZones.mutate(
      zones.map((zone) => zone.id),
      {
        onSuccess: (result) => {
          if (result.deleted.length === 0) {
            // Nothing was deleted: keep the dialog open and explain why.
            setInlineError(result.failed.map((f) => (single ? f.message : `${names.get(f.id)}: ${f.message}`)).join(" "));
            return;
          }
          for (const message of bulkDeleteFlashes(result, "hosted zone", (id) => names.get(id) ?? id)) {
            addFlash(message);
          }
          onDismiss();
          onDeleted?.(result.deleted);
        },
        onError: (error) => setInlineError(errorMessage(error)),
      },
    );
  };

  return (
    <Modal
      visible
      onDismiss={onDismiss}
      header={single ? `Delete ${single}?` : `Delete ${zones.length} hosted zones?`}
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
              loading={deleteZones.isPending}
            >
              Delete
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        {single ? (
          <Box variant="span">
            Permanently delete hosted zone <Box variant="strong">{single}</Box>? You can&apos;t undo
            this action.
          </Box>
        ) : (
          <SpaceBetween size="xs">
            <Box variant="span">
              Permanently delete the following hosted zones? You can&apos;t undo this action.
            </Box>
            <ul aria-label="Hosted zones to delete">
              {zones.map((zone) => (
                <li key={zone.id}>
                  <Box variant="strong">{displayName(zone.name)}</Box> ({zone.id})
                </li>
              ))}
            </ul>
          </SpaceBetween>
        )}
        <Alert type="warning">
          You can delete a hosted zone only when it contains just its default NS and SOA records.
        </Alert>
        {inlineError && (
          <Alert type="error" header={single ? "Couldn't delete hosted zone" : "Couldn't delete hosted zones"}>
            {inlineError}
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

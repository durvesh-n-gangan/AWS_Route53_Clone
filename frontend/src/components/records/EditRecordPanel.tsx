"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useState, type FormEvent } from "react";

import { useFlash } from "@/components/common/FlashProvider";
import { RecordFields } from "@/components/records/RecordFields";
import { ApiError } from "@/lib/api/client";
import { errorMessage, fieldErrorsFrom } from "@/lib/apiErrors";
import { displayName } from "@/lib/format";
import { useUpdateRecord } from "@/lib/queries/records";
import { toDraft, toInput, validateDraft, type RecordErrors } from "@/lib/recordDraft";
import type { RecordSet } from "@/types/api";

interface EditRecordPanelProps {
  zoneId: string;
  zoneName: string;
  record: RecordSet;
  onDone: () => void;
}

/** Split-panel form for one record. Remount it (key) when the selection changes. */
export function EditRecordPanel({ zoneId, zoneName, record, onDone }: EditRecordPanelProps) {
  const [draft, setDraft] = useState(() => toDraft(record, zoneName));
  const [errors, setErrors] = useState<RecordErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const update = useUpdateRecord(zoneId);
  const { addFlash } = useFlash();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const clientErrors = validateDraft(draft);
    setErrors(clientErrors);
    setFormError(null);
    if (Object.keys(clientErrors).length > 0) return;

    update.mutate(
      { id: record.id, record: toInput(draft) },
      {
        onSuccess: (saved) => {
          addFlash({
            type: "success",
            content: `Record ${displayName(saved.name)} (${saved.type}) was updated successfully.`,
          });
          onDone();
        },
        onError: (error) => {
          const fields = fieldErrorsFrom(error);
          if (Object.keys(fields).length > 0) setErrors(fields as RecordErrors);
          else if (error instanceof ApiError && error.status === 409) setErrors({ name: error.message });
          else setFormError(errorMessage(error));
        },
      },
    );
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <SpaceBetween size="l">
        {record.is_default && (
          <Alert type="info">
            This record was created with the hosted zone. You can change its TTL and value only.
          </Alert>
        )}
        {formError && <Alert type="error">{formError}</Alert>}
        <RecordFields
          draft={draft}
          onChange={(next) => {
            setDraft(next);
            setErrors({});
          }}
          errors={errors}
          zoneName={zoneName}
          lockIdentity={record.is_default}
          compact
        />
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button formAction="none" variant="link" onClick={onDone}>
              Cancel
            </Button>
            <Button variant="primary" formAction="submit" loading={update.isPending}>
              Save
            </Button>
          </SpaceBetween>
        </Box>
      </SpaceBetween>
    </form>
  );
}

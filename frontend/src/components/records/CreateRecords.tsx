"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { useFlash } from "@/components/common/FlashProvider";
import { InfoLink } from "@/components/common/InfoLink";
import { useBreadcrumbLabel } from "@/components/layout/ShellContext";
import { RecordFields } from "@/components/records/RecordFields";
import { RecordsHelp } from "@/components/records/recordHelp";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/apiErrors";
import { displayName } from "@/lib/format";
import { ROUTES } from "@/lib/navigation";
import { useCreateRecords } from "@/lib/queries/records";
import { useZone } from "@/lib/queries/zones";
import {
  newDraft,
  toInput,
  validateDraft,
  type RecordDraft,
  type RecordErrors,
  type RecordField,
} from "@/lib/recordDraft";

interface Row {
  key: number;
  draft: RecordDraft;
  errors: RecordErrors;
}

const FIELDS: RecordField[] = ["name", "type", "ttl", "values"];

/**
 * Maps the API's batch errors back to rows. The backend sends either
 * `details.errors[i] = {field: message}` (business rules) or
 * `details.fields[] = {field: "records.i.ttl", message}` (request schema).
 */
export function rowErrorsFrom(error: unknown, rowCount: number): RecordErrors[] | null {
  if (!(error instanceof ApiError)) return null;
  const result: RecordErrors[] = Array.from({ length: rowCount }, () => ({}));
  let found = false;
  const batch = error.details.errors;
  if (Array.isArray(batch)) {
    batch.forEach((entry, index) => {
      if (entry && typeof entry === "object" && index < rowCount) {
        Object.assign(result[index], entry);
        found = true;
      }
    });
  }
  const fields = error.details.fields;
  if (Array.isArray(fields)) {
    for (const item of fields) {
      const match = /^records\.(\d+)\.(\w+)/.exec(String((item as { field?: unknown }).field));
      if (!match) continue;
      const [index, field] = [Number(match[1]), match[2] as RecordField];
      if (index < rowCount && FIELDS.includes(field)) {
        result[index][field] = String((item as { message?: unknown }).message);
        found = true;
      }
    }
  }
  return found ? result : null;
}

export function CreateRecords({ zoneId }: { zoneId: string }) {
  const router = useRouter();
  const zone = useZone(zoneId);
  const createRecords = useCreateRecords(zoneId);
  const { addFlash } = useFlash();
  const nextKey = useRef(1);
  const [rows, setRows] = useState<Row[]>([{ key: 0, draft: newDraft(), errors: {} }]);
  const [formError, setFormError] = useState<string | null>(null);
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
  const zoneName = zone.data.name;

  const updateRow = (key: number, draft: RecordDraft) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, draft, errors: {} } : row)));
  const addRow = () => {
    const key = nextKey.current++;
    setRows((current) => [...current, { key, draft: newDraft(), errors: {} }]);
  };
  const removeRow = (key: number) => setRows((current) => current.filter((row) => row.key !== key));

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const checked = rows.map((row) => ({ ...row, errors: validateDraft(row.draft) }));
    setRows(checked);
    if (checked.some((row) => Object.keys(row.errors).length > 0)) return;

    createRecords.mutate(
      checked.map((row) => toInput(row.draft)),
      {
        onSuccess: ({ items }) => {
          addFlash({
            type: "success",
            content: `Successfully created ${items.length} ${items.length === 1 ? "record" : "records"} in ${displayName(zoneName)}.`,
          });
          router.push(ROUTES.hostedZone(zoneId));
        },
        onError: (error) => {
          const perRow = rowErrorsFrom(error, checked.length);
          if (perRow) {
            setRows((current) => current.map((row, index) => ({ ...row, errors: perRow[index] })));
          }
          setFormError(errorMessage(error));
        },
      },
    );
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <Form
        header={
          <Header
            variant="h1"
            info={<InfoLink topic="records" help={<RecordsHelp />} />}
            description={`Create records in the hosted zone ${displayName(zoneName)}.`}
          >
            Create record
          </Header>
        }
        errorText={formError ?? undefined}
        errorIconAriaLabel="Error"
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button formAction="none" variant="link" onClick={() => router.push(ROUTES.hostedZone(zoneId))}>
              Cancel
            </Button>
            <Button variant="primary" formAction="submit" loading={createRecords.isPending}>
              Create records
            </Button>
          </SpaceBetween>
        }
      >
        <Container
          header={
            <Header
              variant="h2"
              actions={
                <Button formAction="none" disabled>
                  Switch to wizard
                </Button>
              }
            >
              Quick create record
            </Header>
          }
        >
          <SpaceBetween size="l">
            {rows.map((row, index) => (
              <Container
                key={row.key}
                variant="stacked"
                header={
                  <Header
                    variant="h3"
                    actions={
                      rows.length > 1 ? (
                        <Button formAction="none" onClick={() => removeRow(row.key)}>
                          Remove
                        </Button>
                      ) : undefined
                    }
                  >
                    {`Record ${index + 1}`}
                  </Header>
                }
              >
                <RecordFields
                  draft={row.draft}
                  onChange={(draft) => updateRow(row.key, draft)}
                  errors={row.errors}
                  zoneName={zoneName}
                />
              </Container>
            ))}
            <Button formAction="none" iconName="add-plus" onClick={addRow} disabled={rows.length >= 50}>
              Add another record
            </Button>
          </SpaceBetween>
        </Container>
      </Form>
    </form>
  );
}

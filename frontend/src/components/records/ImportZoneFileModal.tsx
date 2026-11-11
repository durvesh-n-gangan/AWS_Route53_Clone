"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FileUpload from "@cloudscape-design/components/file-upload";
import FormField from "@cloudscape-design/components/form-field";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import Textarea from "@cloudscape-design/components/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useFlash } from "@/components/common/FlashProvider";
import { zoneFilesApi, type ZoneFileSource } from "@/lib/api/zoneFiles";
import { errorMessage } from "@/lib/apiErrors";
import { displayName } from "@/lib/format";
import { recordKeys } from "@/lib/queries/records";
import { zoneKeys } from "@/lib/queries/zones";
import type { ImportResult, ImportRow } from "@/types/api";

const STATUS: Record<ImportRow["status"], { type: "success" | "stopped" | "error"; label: string }> = {
  ready: { type: "success", label: "Ready" },
  skipped: { type: "stopped", label: "Skipped" },
  error: { type: "error", label: "Error" },
};

const PLACEHOLDER = `$ORIGIN example.com.
$TTL 300
www   IN  A     192.0.2.10
@     IN  MX    10 mail.example.com.
@     IN  TXT   "v=spf1 mx -all"`;

/** Same limit as the API (bind_io.MAX_IMPORT_BYTES). */
export const MAX_ZONE_FILE_BYTES = 1_000_000;
const TOO_LARGE = "The zone file can be up to 1 MB.";

interface ImportZoneFileModalProps {
  zoneId: string;
  zoneName: string;
  visible: boolean;
  onDismiss: () => void;
}

export function ImportZoneFileModal({ zoneId, zoneName, visible, onDismiss }: ImportZoneFileModalProps) {
  if (!visible) return null;
  return <ImportDialog zoneId={zoneId} zoneName={zoneName} onDismiss={onDismiss} />;
}

function ImportDialog({ zoneId, zoneName, onDismiss }: Omit<ImportZoneFileModalProps, "visible">) {
  const queryClient = useQueryClient();
  const { addFlash } = useFlash();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<ImportResult | null>(null);

  const fileTooLarge = (files[0]?.size ?? 0) > MAX_ZONE_FILE_BYTES;
  const textTooLarge = !files[0] && new TextEncoder().encode(text).length > MAX_ZONE_FILE_BYTES;
  const source: ZoneFileSource | null =
    fileTooLarge || textTooLarge ? null : files[0] ? { file: files[0] } : text.trim() ? { text } : null;

  const previewMutation = useMutation({
    mutationFn: (src: ZoneFileSource) => zoneFilesApi.importZoneFile(zoneId, src, "preview"),
    onSuccess: setPreview,
  });
  const commitMutation = useMutation({
    mutationFn: (src: ZoneFileSource) => zoneFilesApi.importZoneFile(zoneId, src, "commit"),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: recordKeys.all(zoneId) }),
        queryClient.invalidateQueries({ queryKey: zoneKeys.detail(zoneId) }),
        queryClient.invalidateQueries({ queryKey: zoneKeys.lists() }),
      ]);
      addFlash({
        type: "success",
        content: `Imported ${result.created} ${result.created === 1 ? "record" : "records"} into ${displayName(zoneName)}.`,
      });
      onDismiss();
    },
  });

  const resetPreview = () => {
    setPreview(null);
    previewMutation.reset();
    commitMutation.reset();
  };

  const error = previewMutation.error ?? commitMutation.error;

  return (
    <Modal
      visible
      size="large"
      onDismiss={onDismiss}
      header="Import zone file"
      closeAriaLabel="Close dialog"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Cancel
            </Button>
            {preview ? (
              <Button
                variant="primary"
                disabled={preview.ready === 0 || !source}
                loading={commitMutation.isPending}
                onClick={() => source && commitMutation.mutate(source)}
              >
                {`Import ${preview.ready} ${preview.ready === 1 ? "record" : "records"}`}
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={!source}
                loading={previewMutation.isPending}
                onClick={() => source && previewMutation.mutate(source)}
              >
                Preview
              </Button>
            )}
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="l">
        <Box variant="p">
          Paste a BIND zone file or choose one from your computer. The zone&apos;s own SOA and NS
          records are skipped, and any line with a problem is shown before anything is imported.
        </Box>
        {error && (
          <Alert type="error" header="Couldn't read the zone file">
            {errorMessage(error)}
          </Alert>
        )}
        {!preview ? (
          <>
            <FormField label="Zone file" stretch errorText={textTooLarge ? TOO_LARGE : undefined}>
              <Textarea
                value={text}
                rows={10}
                placeholder={PLACEHOLDER}
                disabled={files.length > 0}
                ariaLabel="Zone file"
                onChange={({ detail }) => setText(detail.value)}
              />
            </FormField>
            <FormField
              label="Or upload a file"
              constraintText="Plain text zone file, up to 1 MB."
              errorText={fileTooLarge ? TOO_LARGE : undefined}
            >
              <FileUpload
                value={files}
                accept=".zone,.txt,.db,text/plain"
                onChange={({ detail }) => setFiles(detail.value)}
                showFileSize
                i18nStrings={{
                  uploadButtonText: () => "Choose file",
                  dropzoneText: () => "Drop a zone file to upload",
                  removeFileAriaLabel: () => "Remove file",
                  limitShowFewer: "Show fewer files",
                  limitShowMore: "Show more files",
                  errorIconAriaLabel: "Error",
                  warningIconAriaLabel: "Warning",
                }}
              />
            </FormField>
          </>
        ) : (
          <SpaceBetween size="s">
            <Box>
              <StatusIndicator type="success">{preview.ready} ready</StatusIndicator>{" "}
              <StatusIndicator type="stopped">{preview.skipped} skipped</StatusIndicator>{" "}
              <StatusIndicator type={preview.errors ? "error" : "success"}>
                {preview.errors} with errors
              </StatusIndicator>
            </Box>
            <Table<ImportRow>
              variant="embedded"
              items={preview.rows}
              wrapLines
              columnDefinitions={[
                {
                  id: "status",
                  header: "Status",
                  minWidth: 110,
                  cell: (row) => (
                    <StatusIndicator type={STATUS[row.status].type} wrapText={false}>
                      {STATUS[row.status].label}
                    </StatusIndicator>
                  ),
                },
                { id: "name", header: "Record name", cell: (row) => (row.name ? displayName(row.name) : "-") },
                { id: "type", header: "Type", cell: (row) => row.type || "-" },
                { id: "ttl", header: "TTL", cell: (row) => (row.ttl ? row.ttl : "-") },
                {
                  id: "values",
                  header: "Value",
                  cell: (row) => (
                    <div>
                      {row.values.map((value, index) => (
                        <div key={`${index}-${value}`}>{value}</div>
                      ))}
                    </div>
                  ),
                },
                { id: "message", header: "Details", cell: (row) => row.message || "-" },
              ]}
            />
            <Button onClick={resetPreview}>Edit zone file</Button>
          </SpaceBetween>
        )}
      </SpaceBetween>
    </Modal>
  );
}

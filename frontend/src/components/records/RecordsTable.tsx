"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import CollectionPreferences, {
  type CollectionPreferencesProps,
} from "@cloudscape-design/components/collection-preferences";
import Header from "@cloudscape-design/components/header";
import Pagination from "@cloudscape-design/components/pagination";
import Select, { type SelectProps } from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table, { type TableProps } from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { InfoLink } from "@/components/common/InfoLink";
import { useShell } from "@/components/layout/ShellContext";
import { DeleteRecordsModal } from "@/components/records/DeleteRecordsModal";
import { EditRecordPanel } from "@/components/records/EditRecordPanel";
import { RecordsHelp } from "@/components/records/recordHelp";
import { errorMessage } from "@/lib/apiErrors";
import { displayName } from "@/lib/format";
import { ROUTES } from "@/lib/navigation";
import { useRecords } from "@/lib/queries/records";
import { RECORD_TYPES } from "@/lib/recordTypes";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { HostedZone, RecordSet, RecordType } from "@/types/api";

type Column = TableProps.ColumnDefinition<RecordSet>;

const ROUTING_LABELS: Record<string, string> = { simple: "Simple" };

const COLUMNS: Column[] = [
  { id: "name", header: "Record name", cell: (r) => displayName(r.name), isRowHeader: true },
  { id: "type", header: "Type", cell: (r) => r.type },
  {
    id: "routingPolicy",
    header: "Routing policy",
    cell: (r) => ROUTING_LABELS[r.routing_policy] ?? r.routing_policy,
  },
  { id: "differentiator", header: "Differentiator", cell: (r) => r.set_identifier ?? "-" },
  { id: "alias", header: "Alias", cell: (r) => (r.alias_target ? "Yes" : "No") },
  {
    id: "value",
    header: "Value/Route traffic to",
    cell: (r) => (
      <div>
        {r.values.map((value) => (
          <div key={value}>{value}</div>
        ))}
      </div>
    ),
  },
  { id: "ttl", header: "TTL (seconds)", cell: (r) => r.ttl },
  { id: "healthCheck", header: "Health check ID", cell: () => "-" },
  { id: "evaluateHealth", header: "Evaluate target health", cell: () => "-" },
  { id: "id", header: "Record ID", cell: (r) => r.id },
];

const ANY_TYPE: SelectProps.Option = { value: "", label: "Any type" };
const TYPE_FILTER_OPTIONS: SelectProps.Option[] = [
  ANY_TYPE,
  { value: "SOA", label: "SOA" },
  ...RECORD_TYPES.map((info) => ({ value: info.type, label: info.type })),
];

const DEFAULT_PREFERENCES: CollectionPreferencesProps.Preferences = {
  pageSize: 10,
  wrapLines: true,
  contentDisplay: COLUMNS.map((column) => ({
    id: column.id!,
    visible: !["healthCheck", "evaluateHealth", "id"].includes(column.id!),
  })),
};

export function RecordsTable({ zone }: { zone: HostedZone }) {
  const router = useRouter();
  const { setSplitPanel, setSplitPanelOpen } = useShell();
  const [filteringText, setFilteringText] = useState("");
  const search = useDebouncedValue(filteringText.trim(), 300);
  const [typeFilter, setTypeFilter] = useState<SelectProps.Option>(ANY_TYPE);
  const [page, setPage] = useState(1);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [selectedItems, setSelectedItems] = useState<RecordSet[]>([]);
  const [deleting, setDeleting] = useState<RecordSet[]>([]);

  const pageSize = preferences.pageSize ?? 10;
  const records = useRecords(zone.id, {
    search: search || undefined,
    type: (typeFilter.value || undefined) as RecordType | undefined,
    page,
    page_size: pageSize,
  });
  const items = records.data?.items ?? [];
  const total = records.data?.total ?? 0;
  const pagesCount = Math.max(1, Math.ceil(total / pageSize));
  const filtered = Boolean(search || typeFilter.value);
  const editing = selectedItems.length === 1 ? selectedItems[0] : null;

  // Selecting exactly one record opens it for editing in the split panel.
  useEffect(() => {
    if (!editing) {
      setSplitPanel(null);
      return;
    }
    setSplitPanel({
      header: `Edit record: ${displayName(editing.name)} (${editing.type})`,
      content: (
        <EditRecordPanel
          key={editing.id}
          zoneId={zone.id}
          zoneName={zone.name}
          record={editing}
          onDone={() => setSelectedItems([])}
        />
      ),
    });
    setSplitPanelOpen(true);
  }, [editing, zone.id, zone.name, setSplitPanel, setSplitPanelOpen]);

  useEffect(() => () => setSplitPanel(null), [setSplitPanel]);

  const resetPage = () => {
    setPage(1);
    setSelectedItems([]);
  };

  const empty = filtered ? (
    <Box textAlign="center" color="inherit">
      <SpaceBetween size="m">
        <b>No matches</b>
        <Box variant="p" color="inherit">
          No records match the filter.
        </Box>
        <Button
          onClick={() => {
            setFilteringText("");
            setTypeFilter(ANY_TYPE);
            resetPage();
          }}
        >
          Clear filter
        </Button>
      </SpaceBetween>
    </Box>
  ) : records.isError ? (
    <Box textAlign="center" color="inherit">
      <SpaceBetween size="m">
        <b>Couldn&apos;t load records</b>
        <Box variant="p" color="inherit">
          {errorMessage(records.error)}
        </Box>
        <Button onClick={() => records.refetch()}>Retry</Button>
      </SpaceBetween>
    </Box>
  ) : (
    <Box textAlign="center" color="inherit">
      <b>No records</b>
    </Box>
  );

  return (
    <>
      <Table<RecordSet>
        trackBy="id"
        items={items}
        columnDefinitions={COLUMNS}
        columnDisplay={preferences.contentDisplay}
        wrapLines={preferences.wrapLines}
        loading={records.isPending}
        loadingText="Loading records"
        selectionType="multi"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
        ariaLabels={{
          selectionGroupLabel: "Record selection",
          itemSelectionLabel: (_, r) => `Select ${displayName(r.name)} ${r.type}`,
          allItemsSelectionLabel: () => "Select all records on this page",
        }}
        empty={empty}
        header={
          <Header
            counter={records.data ? `(${total})` : undefined}
            info={<InfoLink topic="records" help={<RecordsHelp />} />}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="refresh"
                  ariaLabel="Refresh records"
                  loading={records.isFetching && !records.isPending}
                  onClick={() => records.refetch()}
                />
                <Button disabled={selectedItems.length === 0} onClick={() => setDeleting(selectedItems)}>
                  Delete record
                </Button>
                <Button disabled>Import zone file</Button>
                <Button variant="primary" onClick={() => router.push(ROUTES.createRecord(zone.id))}>
                  Create record
                </Button>
              </SpaceBetween>
            }
          >
            Records
          </Header>
        }
        filter={
          <SpaceBetween direction="horizontal" size="xs">
            <TextFilter
              filteringText={filteringText}
              filteringPlaceholder="Filter records by property or value"
              filteringAriaLabel="Filter records"
              countText={filtered && records.data ? `${total} ${total === 1 ? "match" : "matches"}` : ""}
              onChange={({ detail }) => {
                setFilteringText(detail.filteringText);
                resetPage();
              }}
            />
            <Select
              selectedOption={typeFilter}
              options={TYPE_FILTER_OPTIONS}
              ariaLabel="Filter by record type"
              onChange={({ detail }) => {
                setTypeFilter(detail.selectedOption);
                resetPage();
              }}
            />
          </SpaceBetween>
        }
        pagination={
          <Pagination
            currentPageIndex={Math.min(page, pagesCount)}
            pagesCount={pagesCount}
            onChange={({ detail }) => {
              setPage(detail.currentPageIndex);
              setSelectedItems([]);
            }}
            ariaLabels={{
              nextPageLabel: "Next page",
              previousPageLabel: "Previous page",
              pageLabel: (pageNumber) => `Page ${pageNumber} of all pages`,
            }}
          />
        }
        preferences={
          <CollectionPreferences
            title="Preferences"
            confirmLabel="Confirm"
            cancelLabel="Cancel"
            preferences={preferences}
            onConfirm={({ detail }) => {
              setPreferences(detail);
              resetPage();
            }}
            pageSizePreference={{
              title: "Page size",
              options: [10, 25, 50, 100].map((value) => ({ value, label: `${value} records` })),
            }}
            wrapLinesPreference={{ label: "Wrap lines", description: "Show long values on several lines." }}
            contentDisplayPreference={{
              title: "Column preferences",
              options: COLUMNS.map((column) => ({
                id: column.id!,
                label: String(column.header),
                alwaysVisible: column.id === "name",
              })),
            }}
          />
        }
      />
      <DeleteRecordsModal
        zoneId={zone.id}
        records={deleting}
        onDismiss={() => setDeleting([])}
        onDeleted={() => setSelectedItems([])}
      />
    </>
  );
}

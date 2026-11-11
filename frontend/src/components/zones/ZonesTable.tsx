"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import CollectionPreferences, {
  type CollectionPreferencesProps,
} from "@cloudscape-design/components/collection-preferences";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Pagination from "@cloudscape-design/components/pagination";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table, { type TableProps } from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { InfoLink } from "@/components/common/InfoLink";
import { DeleteZoneModal } from "@/components/zones/DeleteZoneModal";
import { HostedZonesHelp } from "@/components/zones/zoneHelp";
import { errorMessage } from "@/lib/apiErrors";
import { displayName, formatZoneType, orDash } from "@/lib/format";
import { ROUTES } from "@/lib/navigation";
import { useZones } from "@/lib/queries/zones";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useFollow } from "@/lib/useFollow";
import type { HostedZoneSummary, ZoneSort } from "@/types/api";

type Column = TableProps.ColumnDefinition<HostedZoneSummary>;

/** Server-side sort keys for the sortable columns. */
const SORT_KEYS: Record<string, "name" | "record_count"> = {
  name: "name",
  record_count: "record_count",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100].map((value) => ({
  value,
  label: `${value} hosted zones`,
}));

function useColumns(): Column[] {
  const onFollow = useFollow();
  return [
    {
      id: "name",
      header: "Hosted zone name",
      cell: (zone) => (
        <Link href={ROUTES.hostedZone(zone.id)} onFollow={onFollow}>
          {displayName(zone.name)}
        </Link>
      ),
      sortingField: "name",
      isRowHeader: true,
    },
    { id: "type", header: "Type", cell: (zone) => formatZoneType(zone.type) },
    { id: "createdBy", header: "Created by", cell: (zone) => zone.created_by },
    {
      id: "recordCount",
      header: "Record count",
      cell: (zone) => zone.record_count,
      sortingField: "record_count",
    },
    { id: "description", header: "Description", cell: (zone) => orDash(zone.comment) },
    { id: "id", header: "Hosted zone ID", cell: (zone) => zone.id },
  ];
}

const DEFAULT_PREFERENCES: CollectionPreferencesProps.Preferences = {
  pageSize: 10,
  contentDisplay: [
    { id: "name", visible: true },
    { id: "type", visible: true },
    { id: "createdBy", visible: true },
    { id: "recordCount", visible: true },
    { id: "description", visible: true },
    { id: "id", visible: true },
  ],
};

export function ZonesTable() {
  const router = useRouter();
  const columns = useColumns();
  const [filteringText, setFilteringText] = useState("");
  const search = useDebouncedValue(filteringText.trim(), 300);
  const [page, setPage] = useState(1);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [sortingColumn, setSortingColumn] = useState<TableProps.SortingColumn<HostedZoneSummary>>(
    { sortingField: "name" },
  );
  const [sortingDescending, setSortingDescending] = useState(false);
  const [selectedItems, setSelectedItems] = useState<HostedZoneSummary[]>([]);
  const [zoneToDelete, setZoneToDelete] = useState<HostedZoneSummary | null>(null);

  const pageSize = preferences.pageSize ?? 10;
  const sortKey = SORT_KEYS[sortingColumn.sortingField ?? "name"] ?? "name";
  const sort = (sortingDescending ? `-${sortKey}` : sortKey) as ZoneSort;

  const zones = useZones({ search: search || undefined, sort, page, page_size: pageSize });
  const items = zones.data?.items ?? [];
  const total = zones.data?.total ?? 0;
  const pagesCount = Math.max(1, Math.ceil(total / pageSize));
  const selected = selectedItems[0];

  const resetToFirstPage = () => {
    setPage(1);
    setSelectedItems([]);
  };

  const emptyState = search ? (
    <Box textAlign="center" color="inherit">
      <SpaceBetween size="m">
        <b>No matches</b>
        <Box variant="p" color="inherit">
          We can&apos;t find a match.
        </Box>
        <Button onClick={() => setFilteringText("")}>Clear filter</Button>
      </SpaceBetween>
    </Box>
  ) : zones.isError ? (
    <Box textAlign="center" color="inherit">
      <SpaceBetween size="m">
        <b>Couldn&apos;t load hosted zones</b>
        <Box variant="p" color="inherit">
          {errorMessage(zones.error)}
        </Box>
        <Button onClick={() => zones.refetch()}>Retry</Button>
      </SpaceBetween>
    </Box>
  ) : (
    <Box textAlign="center" color="inherit">
      <SpaceBetween size="m">
        <b>No hosted zones</b>
        <Box variant="p" color="inherit">
          You don&apos;t have any hosted zones.
        </Box>
        <Button onClick={() => router.push(ROUTES.createHostedZone)}>Create hosted zone</Button>
      </SpaceBetween>
    </Box>
  );

  return (
    <>
      <Table<HostedZoneSummary>
        variant="full-page"
        stickyHeader
        trackBy="id"
        items={items}
        columnDefinitions={columns}
        columnDisplay={preferences.contentDisplay}
        loading={zones.isPending}
        loadingText="Loading hosted zones"
        selectionType="single"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
        ariaLabels={{
          selectionGroupLabel: "Hosted zone selection",
          itemSelectionLabel: (_, zone) => `Select ${displayName(zone.name)}`,
          allItemsSelectionLabel: () => "Select all hosted zones",
        }}
        sortingColumn={sortingColumn}
        sortingDescending={sortingDescending}
        onSortingChange={({ detail }) => {
          setSortingColumn(detail.sortingColumn);
          setSortingDescending(detail.isDescending ?? false);
          resetToFirstPage();
        }}
        empty={emptyState}
        header={
          <Header
            variant="awsui-h1-sticky"
            counter={zones.data ? `(${total})` : undefined}
            info={<InfoLink topic="hosted zones" help={<HostedZonesHelp />} />}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="refresh"
                  ariaLabel="Refresh hosted zones"
                  loading={zones.isFetching && !zones.isPending}
                  onClick={() => zones.refetch()}
                />
                <Button
                  disabled={!selected}
                  onClick={() => selected && router.push(ROUTES.hostedZone(selected.id))}
                >
                  View details
                </Button>
                <Button
                  disabled={!selected}
                  onClick={() => selected && router.push(ROUTES.editHostedZone(selected.id))}
                >
                  Edit
                </Button>
                <Button disabled={!selected} onClick={() => setZoneToDelete(selected ?? null)}>
                  Delete
                </Button>
                <Button variant="primary" onClick={() => router.push(ROUTES.createHostedZone)}>
                  Create hosted zone
                </Button>
              </SpaceBetween>
            }
          >
            Hosted zones
          </Header>
        }
        filter={
          <TextFilter
            filteringText={filteringText}
            filteringPlaceholder="Filter hosted zones by property or value"
            filteringAriaLabel="Filter hosted zones"
            countText={search && zones.data ? `${total} ${total === 1 ? "match" : "matches"}` : ""}
            onChange={({ detail }) => {
              setFilteringText(detail.filteringText);
              resetToFirstPage();
            }}
          />
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
              resetToFirstPage();
            }}
            pageSizePreference={{ title: "Page size", options: PAGE_SIZE_OPTIONS }}
            contentDisplayPreference={{
              title: "Column preferences",
              description: "Customize the columns visibility and order.",
              options: columns.map((column) => ({
                id: column.id!,
                label: String(column.header),
                alwaysVisible: column.id === "name",
              })),
            }}
          />
        }
      />
      <DeleteZoneModal
        zone={zoneToDelete}
        onDismiss={() => setZoneToDelete(null)}
        onDeleted={() => setSelectedItems([])}
      />
    </>
  );
}

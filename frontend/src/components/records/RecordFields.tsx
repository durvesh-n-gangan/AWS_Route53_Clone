"use client";

import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import FormField from "@cloudscape-design/components/form-field";
import Grid from "@cloudscape-design/components/grid";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import Toggle from "@cloudscape-design/components/toggle";

import { InfoLink } from "@/components/common/InfoLink";
import {
  RecordNameHelp,
  RecordTypeHelp,
  RoutingPolicyHelp,
  TtlHelp,
  ValueHelp,
} from "@/components/records/recordHelp";
import { displayName } from "@/lib/format";
import type { RecordDraft, RecordErrors } from "@/lib/recordDraft";
import { RECORD_TYPES, recordTypeInfo, TTL_PRESETS } from "@/lib/recordTypes";
import type { RecordType } from "@/types/api";

import styles from "./RecordFields.module.css";

const TYPE_OPTIONS = RECORD_TYPES.map((info) => ({
  value: info.type,
  label: `${info.type} – ${info.description}`,
}));

const UNAVAILABLE = "Not available in this demo";
const ROUTING_OPTIONS = [
  { value: "simple", label: "Simple routing" },
  { value: "weighted", label: "Weighted", disabled: true, description: UNAVAILABLE },
  { value: "latency", label: "Latency", disabled: true, description: UNAVAILABLE },
  { value: "failover", label: "Failover", disabled: true, description: UNAVAILABLE },
  { value: "geolocation", label: "Geolocation", disabled: true, description: UNAVAILABLE },
  { value: "multivalue", label: "Multivalue answer", disabled: true, description: UNAVAILABLE },
];

interface RecordFieldsProps {
  draft: RecordDraft;
  onChange: (draft: RecordDraft) => void;
  errors?: RecordErrors;
  zoneName: string;
  /** Default NS/SOA records: only TTL and value can change. */
  lockIdentity?: boolean;
  /** Narrow layout (split panel) stacks every field. */
  compact?: boolean;
}

/** The fields of one record, shared by Quick create rows and the Edit record panel. */
export function RecordFields({
  draft,
  onChange,
  errors = {},
  zoneName,
  lockIdentity = false,
  compact = false,
}: RecordFieldsProps) {
  const info = recordTypeInfo(draft.type);
  const set = <K extends keyof RecordDraft>(key: K, value: RecordDraft[K]) =>
    onChange({ ...draft, [key]: value });
  const zoneSuffix = `.${displayName(zoneName)}`;
  const typeOptions =
    draft.type === "SOA" ? [{ value: "SOA", label: "SOA – Start of authority" }] : TYPE_OPTIONS;

  const nameField = (
    <FormField
      label="Record name"
      info={<InfoLink topic="record name" help={<RecordNameHelp />} />}
      description="Keep blank to create a record for the root domain."
      errorText={errors.name}
    >
      <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
        <Input
          value={draft.name}
          placeholder="subdomain"
          disabled={lockIdentity}
          ariaLabel="Record name"
          onChange={({ detail }) => set("name", detail.value)}
        />
        <div className={styles.suffix} title={zoneSuffix}>
          {zoneSuffix}
        </div>
      </Grid>
    </FormField>
  );

  const typeField = (
    <FormField
      label="Record type"
      info={<InfoLink topic="record type" help={<RecordTypeHelp />} />}
      errorText={errors.type}
    >
      <Select
        selectedOption={typeOptions.find((option) => option.value === draft.type) ?? null}
        options={typeOptions}
        disabled={lockIdentity}
        ariaLabel="Record type"
        onChange={({ detail }) => set("type", detail.selectedOption.value as RecordType)}
      />
    </FormField>
  );

  const aliasField = (
    <Toggle checked={false} disabled description="Alias records are not available in this demo.">
      Alias
    </Toggle>
  );

  const valueField = (
    <FormField
      label="Value"
      info={<InfoLink topic="value" help={<ValueHelp />} />}
      constraintText={info.hint}
      errorText={errors.values}
      stretch
    >
      <Textarea
        value={draft.value}
        placeholder={info.placeholder}
        rows={3}
        ariaLabel="Value"
        onChange={({ detail }) => set("value", detail.value)}
      />
    </FormField>
  );

  const ttlField = (
    <FormField
      label="TTL (seconds)"
      info={<InfoLink topic="TTL" help={<TtlHelp />} />}
      constraintText="Recommended values: 60 to 172800 (two days)"
      errorText={errors.ttl}
    >
      <div className={styles.ttl}>
        <div className={styles.ttlInput}>
          <Input
            type="number"
            inputMode="numeric"
            value={draft.ttl}
            ariaLabel="TTL (seconds)"
            onChange={({ detail }) => set("ttl", detail.value)}
          />
        </div>
        {TTL_PRESETS.map((preset) => (
          <Button
            key={preset.label}
            formAction="none"
            ariaLabel={`Set TTL to ${preset.seconds} seconds`}
            onClick={() => set("ttl", String(preset.seconds))}
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </FormField>
  );

  const routingField = (
    <FormField
      label="Routing policy"
      info={<InfoLink topic="routing policy" help={<RoutingPolicyHelp />} />}
    >
      <Select
        selectedOption={ROUTING_OPTIONS[0]}
        options={ROUTING_OPTIONS}
        ariaLabel="Routing policy"
        onChange={() => undefined}
      />
    </FormField>
  );

  if (compact) {
    return (
      <SpaceBetween size="l">
        {nameField}
        {typeField}
        {valueField}
        {ttlField}
        {routingField}
      </SpaceBetween>
    );
  }

  return (
    <SpaceBetween size="l">
      <ColumnLayout columns={2}>
        {nameField}
        {typeField}
      </ColumnLayout>
      {aliasField}
      {valueField}
      <ColumnLayout columns={2}>
        {ttlField}
        {routingField}
      </ColumnLayout>
    </SpaceBetween>
  );
}

"use client";

import AttributeEditor from "@cloudscape-design/components/attribute-editor";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import Tiles from "@cloudscape-design/components/tiles";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useFlash } from "@/components/common/FlashProvider";
import { InfoLink } from "@/components/common/InfoLink";
import { DomainNameHelp, HostedZonesHelp, ZoneTypeHelp } from "@/components/zones/zoneHelp";
import { ApiError } from "@/lib/api/client";
import { errorMessage, fieldErrorsFrom } from "@/lib/apiErrors";
import { displayName } from "@/lib/format";
import { ROUTES } from "@/lib/navigation";
import { useCreateZone, useUpdateZone } from "@/lib/queries/zones";
import type { HostedZone, Tag, VpcAssociation, ZoneType } from "@/types/api";

const MAX_TAGS = 50;
const MAX_DESCRIPTION = 256;
const DOMAIN_PATTERN =
  /^(?=.{1,253}\.?$)(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z0-9_-]*[a-z_-][a-z0-9_-]*\.?$/i;
const VPC_ID_PATTERN = /^vpc-[0-9a-f]{8}([0-9a-f]{9})?$/;

export const REGIONS = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "ca-central-1",
  "eu-west-1",
  "eu-west-2",
  "eu-central-1",
  "ap-south-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "sa-east-1",
].map((region) => ({ value: region, label: region }));

type Errors = Record<string, string>;

interface FormState {
  name: string;
  comment: string;
  type: ZoneType;
  vpcs: VpcAssociation[];
  tags: Tag[];
}

export function validateZoneForm(state: FormState, mode: "create" | "edit"): Errors {
  const errors: Errors = {};
  if (mode === "create") {
    const name = state.name.trim();
    if (!name) errors.name = "Enter a domain name.";
    else if (!DOMAIN_PATTERN.test(name)) errors.name = "Enter a valid domain name, such as example.com.";
    if (state.type === "private") {
      if (state.vpcs.length === 0) errors.vpcs = "Associate at least one VPC with a private hosted zone.";
      state.vpcs.forEach((vpc, index) => {
        if (!vpc.region) errors[`vpcs.${index}.region`] = "Choose a Region.";
        if (!VPC_ID_PATTERN.test(vpc.vpc_id.trim())) {
          errors[`vpcs.${index}.vpc_id`] = "Enter a VPC ID such as vpc-0a1b2c3d4e5f67890.";
        }
      });
    }
  }
  if (state.comment.length > MAX_DESCRIPTION) {
    errors.comment = `The description can have up to ${MAX_DESCRIPTION} characters.`;
  }
  const seen = new Set<string>();
  state.tags.forEach((tag, index) => {
    const key = tag.key.trim();
    if (!key) errors[`tags.${index}.key`] = "Enter a key.";
    else if (seen.has(key)) errors[`tags.${index}.key`] = "Keys must be unique.";
    seen.add(key);
  });
  return errors;
}

interface ZoneFormProps {
  mode: "create" | "edit";
  zone?: HostedZone;
}

export function ZoneForm({ mode, zone }: ZoneFormProps) {
  const router = useRouter();
  const { addFlash } = useFlash();
  const createZone = useCreateZone();
  const updateZone = useUpdateZone(zone?.id ?? "");
  const mutation = mode === "create" ? createZone : updateZone;

  const [state, setState] = useState<FormState>({
    name: zone ? displayName(zone.name) : "",
    comment: zone?.comment ?? "",
    type: zone?.type ?? "public",
    vpcs: zone?.vpcs ?? [],
    tags: zone?.tags ?? [],
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | undefined>();

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((current) => ({ ...current, [key]: value }));
    // Editing a field clears its stale error (including per-row VPC and tag errors).
    setErrors((current) => {
      const prefix = `${key}.`;
      const next = Object.fromEntries(
        Object.entries(current).filter(([field]) => field !== key && !field.startsWith(prefix)),
      );
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  };

  const cancelHref = zone ? ROUTES.hostedZone(zone.id) : ROUTES.hostedZones;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const clientErrors = validateZoneForm(state, mode);
    setErrors(clientErrors);
    setFormError(undefined);
    if (Object.keys(clientErrors).length > 0) return;

    const tags = state.tags.map((tag) => ({ key: tag.key.trim(), value: tag.value }));
    const onError = (error: unknown) => {
      if (error instanceof ApiError && error.status === 409) {
        setErrors({ name: error.message });
        return;
      }
      const fields = fieldErrorsFrom(error);
      setErrors(fields);
      setFormError(fields.body ?? errorMessage(error));
    };

    if (mode === "create") {
      createZone.mutate(
        {
          name: state.name.trim(),
          comment: state.comment,
          type: state.type,
          vpcs: state.type === "private" ? state.vpcs.map((v) => ({ ...v, vpc_id: v.vpc_id.trim() })) : [],
          tags,
        },
        {
          onSuccess: (created) => {
            addFlash({
              type: "success",
              content: `Hosted zone ${displayName(created.name)} was created successfully.`,
            });
            router.push(ROUTES.hostedZone(created.id));
          },
          onError,
        },
      );
    } else if (zone) {
      updateZone.mutate(
        { comment: state.comment, tags },
        {
          onSuccess: (updated) => {
            addFlash({
              type: "success",
              content: `Hosted zone ${displayName(updated.name)} was updated successfully.`,
            });
            router.push(ROUTES.hostedZone(updated.id));
          },
          onError,
        },
      );
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <Form
        header={
          <Header
            variant="h1"
            info={<InfoLink topic="hosted zones" help={<HostedZonesHelp />} />}
            description={
              mode === "create"
                ? undefined
                : "You can change the description and tags of a hosted zone."
            }
          >
            {mode === "create" ? "Create hosted zone" : "Edit hosted zone"}
          </Header>
        }
        errorText={formError}
        errorIconAriaLabel="Error"
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button formAction="none" variant="link" onClick={() => router.push(cancelHref)}>
              Cancel
            </Button>
            <Button variant="primary" formAction="submit" loading={mutation.isPending}>
              {mode === "create" ? "Create hosted zone" : "Save changes"}
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="l">
          <Container
            header={
              <Header
                variant="h2"
                description="A hosted zone is a container that holds information about how you want to route traffic for a domain, such as example.com, and its subdomains."
              >
                Hosted zone configuration
              </Header>
            }
          >
            <SpaceBetween size="l">
              <FormField
                label="Domain name"
                info={<InfoLink topic="domain name" help={<DomainNameHelp />} />}
                description="This is the name of the domain that you want to route traffic for."
                constraintText={
                  mode === "create"
                    ? "Valid characters: a-z, 0-9, - (hyphen), _ (underscore) and . (period)"
                    : undefined
                }
                errorText={errors.name}
              >
                <Input
                  value={state.name}
                  placeholder="example.com"
                  disabled={mode === "edit"}
                  onChange={({ detail }) => update("name", detail.value)}
                />
              </FormField>
              <FormField
                label={
                  <span>
                    Description <i>- optional</i>
                  </span>
                }
                description="This value lets you distinguish hosted zones that have the same name."
                constraintText={`The description can have up to ${MAX_DESCRIPTION} characters. ${state.comment.length}/${MAX_DESCRIPTION}`}
                errorText={errors.comment}
              >
                <Textarea
                  value={state.comment}
                  placeholder="The hosted zone is used for..."
                  rows={3}
                  onChange={({ detail }) => update("comment", detail.value)}
                />
              </FormField>
              <FormField
                label="Type"
                info={<InfoLink topic="hosted zone type" help={<ZoneTypeHelp />} />}
                description="The type indicates whether you want to route traffic on the internet or in an Amazon VPC."
              >
                <Tiles
                  value={state.type}
                  onChange={({ detail }) => update("type", detail.value as ZoneType)}
                  items={[
                    {
                      value: "public",
                      label: "Public hosted zone",
                      description: "A public hosted zone determines how traffic is routed on the internet.",
                      disabled: mode === "edit",
                    },
                    {
                      value: "private",
                      label: "Private hosted zone",
                      description: "A private hosted zone determines how traffic is routed within an Amazon VPC.",
                      disabled: mode === "edit",
                    },
                  ]}
                />
              </FormField>
            </SpaceBetween>
          </Container>

          {state.type === "private" && (
            <Container
              header={
                <Header
                  variant="h2"
                  description="To use this hosted zone to resolve DNS queries for one or more VPCs, choose the VPCs. VPCs are mocked in this demo."
                >
                  VPCs to associate with the hosted zone
                </Header>
              }
            >
              <FormField errorText={errors.vpcs} stretch>
                <AttributeEditor<VpcAssociation>
                  items={state.vpcs}
                  addButtonText="Add VPC"
                  removeButtonText="Remove VPC"
                  empty="No VPCs associated with the hosted zone."
                  isItemRemovable={() => mode === "create"}
                  disableAddButton={mode === "edit"}
                  onAddButtonClick={() =>
                    update("vpcs", [...state.vpcs, { region: "us-east-1", vpc_id: "" }])
                  }
                  onRemoveButtonClick={({ detail }) =>
                    update(
                      "vpcs",
                      state.vpcs.filter((_, index) => index !== detail.itemIndex),
                    )
                  }
                  definition={[
                    {
                      label: "Region",
                      errorText: (_, index) => errors[`vpcs.${index}.region`],
                      control: (vpc, index) => (
                        <Select
                          selectedOption={REGIONS.find((r) => r.value === vpc.region) ?? null}
                          options={REGIONS}
                          disabled={mode === "edit"}
                          placeholder="Choose a Region"
                          onChange={({ detail }) =>
                            update(
                              "vpcs",
                              state.vpcs.map((v, i) =>
                                i === index ? { ...v, region: detail.selectedOption.value ?? "" } : v,
                              ),
                            )
                          }
                        />
                      ),
                    },
                    {
                      label: "VPC ID",
                      errorText: (_, index) => errors[`vpcs.${index}.vpc_id`],
                      control: (vpc, index) => (
                        <Input
                          value={vpc.vpc_id}
                          placeholder="vpc-0a1b2c3d4e5f67890"
                          disabled={mode === "edit"}
                          onChange={({ detail }) =>
                            update(
                              "vpcs",
                              state.vpcs.map((v, i) =>
                                i === index ? { ...v, vpc_id: detail.value } : v,
                              ),
                            )
                          }
                        />
                      ),
                    },
                  ]}
                />
              </FormField>
            </Container>
          )}

          <Container
            header={
              <Header
                variant="h2"
                description="Apply tags to hosted zones to help organize and identify them."
              >
                Tags
              </Header>
            }
          >
            <AttributeEditor<Tag>
              items={state.tags}
              addButtonText="Add tag"
              removeButtonText="Remove"
              empty="No tags associated with the resource."
              disableAddButton={state.tags.length >= MAX_TAGS}
              additionalInfo={`You can add up to ${MAX_TAGS - state.tags.length} more tags.`}
              onAddButtonClick={() => update("tags", [...state.tags, { key: "", value: "" }])}
              onRemoveButtonClick={({ detail }) =>
                update(
                  "tags",
                  state.tags.filter((_, index) => index !== detail.itemIndex),
                )
              }
              definition={[
                {
                  label: "Key",
                  errorText: (_, index) => errors[`tags.${index}.key`],
                  control: (tag, index) => (
                    <Input
                      value={tag.key}
                      placeholder="Enter key"
                      onChange={({ detail }) =>
                        update(
                          "tags",
                          state.tags.map((t, i) => (i === index ? { ...t, key: detail.value } : t)),
                        )
                      }
                    />
                  ),
                },
                {
                  label: (
                    <span>
                      Value <i>- optional</i>
                    </span>
                  ),
                  control: (tag, index) => (
                    <Input
                      value={tag.value}
                      placeholder="Enter value"
                      onChange={({ detail }) =>
                        update(
                          "tags",
                          state.tags.map((t, i) => (i === index ? { ...t, value: detail.value } : t)),
                        )
                      }
                    />
                  ),
                },
              ]}
            />
          </Container>
        </SpaceBetween>
      </Form>
    </form>
  );
}

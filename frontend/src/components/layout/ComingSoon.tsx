"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";

import { InfoLink } from "@/components/common/InfoLink";
import { HelpTopic } from "@/components/layout/HelpPanelContent";
import { ROUTES } from "@/lib/navigation";
import { useFollow } from "@/lib/useFollow";

interface ComingSoonProps {
  title: string;
  description: string;
}

/** Placeholder for console sections that are outside the scope of this clone. */
export function ComingSoon({ title, description }: ComingSoonProps) {
  const onFollow = useFollow();

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description={description}
          info={
            <InfoLink
              topic={title}
              help={
                <HelpTopic title={title}>
                  <Box variant="p">{description}</Box>
                  <Box variant="p">This section is a placeholder in this demo console.</Box>
                </HelpTopic>
              }
            />
          }
        >
          {title}
        </Header>
      }
    >
      <Container>
        <Box textAlign="center" padding={{ vertical: "xxxl" }}>
          <SpaceBetween size="m">
            <Box variant="h2" tagOverride="p">
              Coming Soon
            </Box>
            <Box variant="p" color="text-body-secondary">
              {title} is not available in this demo console yet.
            </Box>
            <Button href={ROUTES.hostedZones} onFollow={onFollow}>
              Go to hosted zones
            </Button>
          </SpaceBetween>
        </Box>
      </Container>
    </ContentLayout>
  );
}

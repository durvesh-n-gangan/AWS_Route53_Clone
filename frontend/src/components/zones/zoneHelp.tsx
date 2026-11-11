import Box from "@cloudscape-design/components/box";

import { HelpTopic } from "@/components/layout/HelpPanelContent";

export function HostedZonesHelp() {
  return (
    <HelpTopic title="Hosted zones">
      <Box variant="p">
        A hosted zone is a container for records. Records hold information about how you want to
        route traffic for a domain, such as example.com, and its subdomains.
      </Box>
      <Box variant="p">
        A <strong>public</strong> hosted zone answers queries from the internet. A{" "}
        <strong>private</strong> hosted zone answers queries only from the VPCs you associate with
        it.
      </Box>
      <Box variant="p">
        When you create a hosted zone, an NS record and an SOA record are created for it
        automatically. You can&apos;t delete a hosted zone until you delete every other record in
        it.
      </Box>
    </HelpTopic>
  );
}

export function DomainNameHelp() {
  return (
    <HelpTopic title="Domain name">
      <Box variant="p">
        Enter the name of the domain that you want to route traffic for, such as example.com. A
        trailing dot is optional; names are stored in lowercase.
      </Box>
      <Box variant="p">
        Each label can have up to 63 characters, and the full name can have up to 253 characters.
      </Box>
    </HelpTopic>
  );
}

export function ZoneTypeHelp() {
  return (
    <HelpTopic title="Hosted zone type">
      <Box variant="p">
        Choose a public hosted zone to route internet traffic, or a private hosted zone to route
        traffic inside one or more VPCs. You can&apos;t change the type after you create the zone.
      </Box>
    </HelpTopic>
  );
}

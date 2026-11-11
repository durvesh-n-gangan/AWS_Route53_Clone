import Box from "@cloudscape-design/components/box";

import { HelpTopic } from "@/components/layout/HelpPanelContent";

export function RecordsHelp() {
  return (
    <HelpTopic title="Records">
      <Box variant="p">
        Records tell DNS resolvers how to answer queries for a domain name. Each record set has a
        name, a type, a TTL and one or more values.
      </Box>
      <Box variant="p">
        The NS and SOA records were created with the hosted zone. You can change their TTL and
        values, but you can&apos;t delete them.
      </Box>
    </HelpTopic>
  );
}

export function RecordNameHelp() {
  return (
    <HelpTopic title="Record name">
      <Box variant="p">
        Enter the subdomain, such as <strong>www</strong>, or leave it blank for the root domain.
        The zone name is added for you. Start with <strong>*.</strong> for a wildcard record.
      </Box>
    </HelpTopic>
  );
}

export function RecordTypeHelp() {
  return (
    <HelpTopic title="Record type">
      <Box variant="p">
        The type decides what the value means: an IPv4 address (A), an IPv6 address (AAAA),
        another name (CNAME), mail servers (MX), text (TXT) and so on.
      </Box>
      <Box variant="p">
        A CNAME record can&apos;t be created for the root domain, and no other record can share a
        name with a CNAME record.
      </Box>
    </HelpTopic>
  );
}

export function ValueHelp() {
  return (
    <HelpTopic title="Value">
      <Box variant="p">
        Enter one value per line. The expected format depends on the record type and is shown
        under the field.
      </Box>
    </HelpTopic>
  );
}

export function TtlHelp() {
  return (
    <HelpTopic title="TTL (seconds)">
      <Box variant="p">
        How long resolvers cache this record. Shorter values make changes visible sooner; longer
        values reduce the number of queries.
      </Box>
    </HelpTopic>
  );
}

export function RoutingPolicyHelp() {
  return (
    <HelpTopic title="Routing policy">
      <Box variant="p">
        Simple routing answers every query with all of the record&apos;s values. Other routing
        policies are not available in this demo.
      </Box>
    </HelpTopic>
  );
}

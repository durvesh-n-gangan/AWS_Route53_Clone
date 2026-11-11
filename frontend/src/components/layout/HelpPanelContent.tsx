import Box from "@cloudscape-design/components/box";
import HelpPanel from "@cloudscape-design/components/help-panel";
import type { ReactNode } from "react";

interface HelpTopicProps {
  title: string;
  children: ReactNode;
}

/** A help-panel page: a heading plus free-form explanatory content. */
export function HelpTopic({ title, children }: HelpTopicProps) {
  return <HelpPanel header={<h2>{title}</h2>}>{children}</HelpPanel>;
}

/** Shown when the help panel is opened without a specific topic. */
export function DefaultHelp() {
  return (
    <HelpTopic title="Route 53">
      <Box variant="p">
        Route 53 is a domain name system (DNS) service. In this console you manage hosted zones,
        which hold the DNS records that tell resolvers where to send traffic for a domain.
      </Box>
      <Box variant="h3">Key ideas</Box>
      <ul>
        <li>
          A <strong>hosted zone</strong> is a container for the records of one domain, such as
          example.com.
        </li>
        <li>
          A <strong>record</strong> maps a name and type (A, AAAA, CNAME, MX and so on) to one or
          more values.
        </li>
        <li>
          Every zone starts with an <strong>NS</strong> and an <strong>SOA</strong> record that
          describe who is authoritative for it.
        </li>
      </ul>
      <Box variant="p" color="text-body-secondary">
        This is a demonstration console. No DNS queries are answered and no AWS resources are
        created.
      </Box>
    </HelpTopic>
  );
}

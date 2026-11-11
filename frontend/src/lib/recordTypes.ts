import type { RecordType } from "@/types/api";

export interface RecordTypeInfo {
  type: RecordType;
  description: string;
  placeholder: string;
  hint: string;
}

/** The record types users can create, with the console's short descriptions. */
export const RECORD_TYPES: RecordTypeInfo[] = [
  {
    type: "A",
    description: "Routes traffic to an IPv4 address and some AWS resources",
    placeholder: "192.0.2.235",
    hint: "IPv4 address. Enter multiple addresses on separate lines.",
  },
  {
    type: "AAAA",
    description: "Routes traffic to an IPv6 address and some AWS resources",
    placeholder: "2001:db8::8a2e:370:7334",
    hint: "IPv6 address. Enter multiple addresses on separate lines.",
  },
  {
    type: "CAA",
    description: "Restricts CAs that can create SSL/TLS certifications for the domain",
    placeholder: '0 issue "ca.example.net"',
    hint: 'Format: [flags] [tag] "[value]". Enter multiple values on separate lines.',
  },
  {
    type: "CNAME",
    description: "Routes traffic to another domain name and to some AWS resources",
    placeholder: "www.example.com",
    hint: "The domain name that you want to resolve to. Only one value is allowed.",
  },
  {
    type: "MX",
    description: "Specifies mail servers",
    placeholder: "10 mailserver.example.com",
    hint: "Format: [priority] [mail server host name]. Enter multiple values on separate lines.",
  },
  {
    type: "NS",
    description: "Name servers for a hosted zone",
    placeholder: "ns1.example.com",
    hint: "The domain names of the name servers. Enter multiple values on separate lines.",
  },
  {
    type: "PTR",
    description: "Maps an IP address to a domain name",
    placeholder: "hostname.example.com",
    hint: "The domain name that you want to return.",
  },
  {
    type: "SRV",
    description: "Application-specific values that identify servers",
    placeholder: "1 10 5269 xmpp-server.example.com",
    hint: "Format: [priority] [weight] [port] [server host name].",
  },
  {
    type: "TXT",
    description: "Used to verify email senders and for application-specific values",
    placeholder: '"Sample Text Entries"',
    hint: "Enclose text in quotation marks. Enter multiple values on separate lines.",
  },
];

const SOA_INFO: RecordTypeInfo = {
  type: "SOA",
  description: "Start of authority for the hosted zone",
  placeholder: "ns-1.awsdns-01.com. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400",
  hint: "Created automatically with the hosted zone.",
};

export function recordTypeInfo(type: RecordType): RecordTypeInfo {
  return RECORD_TYPES.find((info) => info.type === type) ?? SOA_INFO;
}

export const TTL_PRESETS = [
  { label: "1m", seconds: 60 },
  { label: "1h", seconds: 3600 },
  { label: "1d", seconds: 86400 },
];

export const MAX_TTL = 2_147_483_647;

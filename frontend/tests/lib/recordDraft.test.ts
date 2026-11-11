import { describe, expect, it } from "vitest";

import { newDraft, toDraft, toInput, validateDraft, type RecordDraft } from "@/lib/recordDraft";

import { recordSet } from "../utils/fixtures";

const draft = (overrides: Partial<RecordDraft>): RecordDraft => ({ ...newDraft(), ...overrides });

describe("record drafts", () => {
  it("turns a stored record into a zone-relative draft", () => {
    const record = recordSet({ name: "www.example.com.", values: ["192.0.2.1", "192.0.2.2"] });
    expect(toDraft(record, "example.com.")).toEqual({
      name: "www",
      type: "A",
      ttl: "300",
      value: "192.0.2.1\n192.0.2.2",
    });
    expect(toDraft(recordSet({ name: "example.com." }), "example.com.").name).toBe("");
  });

  it("builds the API input with one value per non-empty line", () => {
    expect(toInput(draft({ name: " www ", ttl: "60", value: "192.0.2.1\n\n 192.0.2.2 \n" }))).toEqual({
      name: "www",
      type: "A",
      ttl: 60,
      values: ["192.0.2.1", "192.0.2.2"],
      routing_policy: "simple",
    });
  });
});

describe("validateDraft", () => {
  it("requires a value", () => {
    expect(validateDraft(draft({ value: "  \n " })).values).toBe("Enter a value.");
  });

  it.each(["-1", "abc", "1.5", "2147483648", ""])("rejects TTL %s", (ttl) => {
    expect(validateDraft(draft({ ttl, value: "192.0.2.1" })).ttl).toBeDefined();
  });

  it.each(["0", "2147483647"])("accepts TTL %s", (ttl) => {
    expect(validateDraft(draft({ ttl, value: "192.0.2.1" }))).toEqual({});
  });

  it.each([
    ["A", "256.1.1.1"],
    ["AAAA", "192.0.2.1"],
    ["CNAME", "a.example.org\nb.example.org"],
    ["MX", "mail.example.com"],
    ["SRV", "10 5 sip.example.com"],
    ["CAA", "0 issue unquoted"],
  ] as const)("catches an obviously bad %s value", (type, value) => {
    expect(validateDraft(draft({ type, value })).values).toBeDefined();
  });

  it.each([
    ["A", "192.0.2.1\n198.51.100.2"],
    ["AAAA", "2001:db8::1"],
    ["MX", "10 mail.example.com"],
    ["SRV", "10 5 5060 sip.example.com"],
    ["CAA", '0 issue "ca.example.net"'],
    ["TXT", '"anything"'],
  ] as const)("lets a good %s value through", (type, value) => {
    expect(validateDraft(draft({ type, value }))).toEqual({});
  });
});

import { expect, test, type Page } from "@playwright/test";

/**
 * Walks through the assignment requirements (docs/ASSIGNMENT.md) one area at a time and saves a
 * screenshot per area as evidence. Run it against the deployed site with
 * `E2E_BASE_URL=<url> npx playwright test e2e/requirements.spec.ts`.
 * Screenshots go to $EVIDENCE_DIR (default test-results/evidence).
 */
test.describe.configure({ mode: "serial" });

const EVIDENCE_DIR = process.env.EVIDENCE_DIR ?? "test-results/evidence";
const RUN = Date.now();
const ZONE = `req-${RUN}.test`;
const SECOND_ZONE = `req-${RUN}-b.test`;
let page: Page;
let zoneId = "";

const shot = (name: string) => page.screenshot({ path: `${EVIDENCE_DIR}/${name}.png`, fullPage: true });
const recordsTable = () => page.getByRole("table").filter({ hasText: "Record name" });
const zonesTable = () => page.getByRole("table").filter({ hasText: "Hosted zone name" });
const api = (path: string) => `/api/v1${path}`;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
});

test.afterAll(async () => {
  // Leave the demo as we found it, even if a step failed half-way.
  for (const name of [ZONE, SECOND_ZONE]) {
    const list = await page.request.get(api(`/hostedzones?search=${encodeURIComponent(name)}`));
    if (!list.ok()) continue;
    for (const zone of (await list.json()).items as { id: string }[]) {
      const records = await page.request.get(api(`/hostedzones/${zone.id}/records?page_size=100`));
      const ids = ((await records.json()).items as { id: string; is_default: boolean }[])
        .filter((record) => !record.is_default)
        .map((record) => record.id);
      if (ids.length) await page.request.post(api(`/hostedzones/${zone.id}/records/bulk-delete`), { data: { ids } });
      await page.request.delete(api(`/hostedzones/${zone.id}`));
    }
  }
  await page.close();
});

test("auth: login, session survives a reload, cookie is persistent", async () => {
  await page.goto("/route53/v2/hostedzones");
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await expect(page.getByText("Not affiliated with, endorsed by, or connected to Amazon Web Services")).toBeVisible();
  await shot("01-sign-in");

  await page.getByRole("textbox", { name: "IAM user name" }).fill("admin");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/route53\/v2\/hostedzones$/);

  await page.reload();
  await expect(page).toHaveURL(/\/route53\/v2\/hostedzones$/);
  const cookie = (await page.context().cookies()).find((c) => c.name === "r53_session");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.expires ?? -1).toBeGreaterThan(Date.now() / 1000); // survives a browser restart
});

test("auth: IAM, Organizations, Billing are mocked in the account menu", async () => {
  await page.getByRole("button", { name: /Account menu/ }).click();
  for (const item of ["Account", "Organization", "Billing and Cost Management", "Security credentials"]) {
    await expect(page.getByRole("menuitem", { name: item, exact: true })).toHaveAttribute("aria-disabled", "true");
  }
  await shot("02-account-menu");
  await page.keyboard.press("Escape");
});

test("hosted zones: view, create, search", async () => {
  await expect(zonesTable().getByRole("link", { name: "example.com", exact: true })).toBeVisible();

  for (const name of [ZONE, SECOND_ZONE]) {
    const created = await page.request.post(api("/hostedzones"), { data: { name, comment: "Requirements check" } });
    expect(created.status()).toBe(201);
    if (name === ZONE) zoneId = (await created.json()).id;
  }
  await page.reload();
  await expect(zonesTable().getByRole("link", { name: ZONE, exact: true })).toBeVisible();

  await page.getByPlaceholder("Filter hosted zones by property or value").fill(`req-${RUN}`);
  await expect(zonesTable().getByRole("link")).toHaveCount(2);
  await shot("03-zones-search");
  await page.getByPlaceholder("Filter hosted zones by property or value").fill("");
});

test("hosted zones: edit description and see it persisted", async () => {
  await page.goto(`/route53/v2/hostedzones/${zoneId}/edit`);
  const description = page.getByRole("textbox", { name: /Description/ });
  await description.fill("Edited by the requirements check");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(`Hosted zone ${ZONE} was updated successfully.`)).toBeVisible();

  await page.reload();
  await expect(page.getByText("Edited by the requirements check")).toBeVisible();
  await shot("04-zone-details");
});

test("records: all nine types, view, type filter, search, pagination", async () => {
  const records = [
    { name: "www", type: "A", ttl: 300, values: ["192.0.2.10"] },
    { name: "v6", type: "AAAA", ttl: 300, values: ["2001:db8::10"] },
    { name: "alias", type: "CNAME", ttl: 300, values: [`www.${ZONE}`] },
    { name: "@", type: "TXT", ttl: 300, values: ['"v=spf1 -all"'] },
    { name: "@", type: "MX", ttl: 300, values: [`10 mail.${ZONE}`] },
    { name: "sub", type: "NS", ttl: 300, values: ["ns1.example.net"] },
    { name: "10", type: "PTR", ttl: 300, values: ["host.example.com"] },
    { name: "_sip._tcp", type: "SRV", ttl: 300, values: ["10 5 5060 sip.example.com"] },
    { name: "@", type: "CAA", ttl: 300, values: ['0 issue "ca.example.net"'] },
  ];
  const response = await page.request.post(api(`/hostedzones/${zoneId}/records`), { data: { records } });
  expect(response.status()).toBe(201);

  await page.goto(`/route53/v2/hostedzones/${zoneId}`);
  await expect(page.getByText("(11)").first()).toBeVisible(); // 9 new record sets + default SOA and NS
  await expect(recordsTable().getByRole("row")).toHaveCount(11); // header + first page of 10
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(recordsTable().getByRole("row")).toHaveCount(2); // header + the 11th record
  await page.getByRole("button", { name: "Previous page" }).click();
  await shot("05-records-all-types");

  await page.getByRole("button", { name: /Filter by record type/ }).click();
  await page.getByRole("option", { name: "SRV", exact: true }).click();
  await expect(recordsTable().getByRole("row")).toHaveCount(2);
  await page.getByRole("button", { name: /Filter by record type/ }).click();
  await page.getByRole("option", { name: "Any type" }).click();

  await page.getByPlaceholder("Filter records by property or value").fill("192.0.2.10");
  await expect(recordsTable().getByRole("row")).toHaveCount(2);
  await shot("06-records-search");
  await page.getByPlaceholder("Filter records by property or value").fill("");
});

test("records: validation errors show on the form", async () => {
  await page.goto(`/route53/v2/hostedzones/${zoneId}/records/create`);
  await page.getByRole("textbox", { name: "Record name" }).fill("bad");
  await page.getByRole("textbox", { name: "Value", exact: true }).fill("999.1.1.1");
  await page.getByRole("button", { name: "Create records" }).click();
  await expect(page.getByText(/not a valid IPv4 address/i)).toBeVisible();
  await shot("07-record-validation");
});

test("placeholders: Coming Soon pages", async () => {
  const pages: [string, string][] = [
    ["home", "Dashboard"],
    ["trafficpolicies", "Traffic policies"],
    ["healthchecks", "Health checks"],
    ["resolver", "Resolver"],
    ["profiles", "Profiles"],
  ];
  for (const [path, title] of pages) {
    await page.goto(`/route53/v2/${path}`);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.getByText("Coming Soon")).toBeVisible();
  }
  await shot("08-coming-soon");
});

test("bonus: BIND import, JSON and BIND export", async () => {
  await page.goto(`/route53/v2/hostedzones/${zoneId}`);
  await page.getByRole("button", { name: "Import zone file" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Zone file" }).fill("imported 300 IN A 192.0.2.50\nbroken IN A 999.1.1.1\n");
  await dialog.getByRole("button", { name: "Preview" }).click();
  await expect(dialog.getByText("1 ready")).toBeVisible();
  await expect(dialog.getByText("1 with errors")).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE_DIR}/09-import-preview.png` });
  await dialog.getByRole("button", { name: "Import 1 record" }).click();
  await expect(page.getByText(`Imported 1 record into ${ZONE}.`)).toBeVisible();

  for (const [item, extension] of [
    ["Export as JSON", ".json"],
    ["Export as BIND zone file", ".zone"],
  ]) {
    await page.getByRole("button", { name: "Export zone file" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: item }).click();
    expect((await download).suggestedFilename()).toBe(`${ZONE}${extension}`);
  }
});

test("bonus: dark mode and keyboard shortcuts", async () => {
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Dark" }).click();
  await expect(page.locator("body")).toHaveClass(/awsui-dark-mode/);
  await page.waitForTimeout(1_000); // Cloudscape fades the colours; capture after the fade
  await page.screenshot({ path: `${EVIDENCE_DIR}/10-dark-mode.png` });
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Light" }).click();
  await expect(page.locator("body")).not.toHaveClass(/awsui-dark-mode/);

  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  await page.keyboard.press("Escape");
});

test("bonus: bulk delete records and hosted zones", async () => {
  await page.goto(`/route53/v2/hostedzones/${zoneId}`);
  const zonePattern = ZONE.replace(/\./g, "\\.");
  // Select everything on the page except the default SOA and NS, delete, and repeat until
  // only the two default records are left (the records table pages 10 at a time).
  await expect(recordsTable().getByRole("row")).toHaveCount(11); // 12 records, 10 per page
  for (let round = 0; round < 3; round += 1) {
    if ((await recordsTable().getByRole("row").count()) <= 3) break;
    await page.getByRole("checkbox", { name: "Select all records on this page" }).check();
    await page.getByRole("checkbox", { name: new RegExp(`^Select ${zonePattern} SOA`) }).uncheck();
    await page.getByRole("checkbox", { name: new RegExp(`^Select ${zonePattern} NS`) }).uncheck();
    await page.getByRole("button", { name: "Delete record" }).click();
    if (round === 0) await page.screenshot({ path: `${EVIDENCE_DIR}/11-bulk-delete-records.png` });
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.reload();
    // Wait for real rows (not the "Loading records" placeholder) before counting again.
    await expect(page.getByRole("checkbox", { name: new RegExp(`^Select ${zonePattern} SOA`) })).toBeVisible();
  }
  await expect(recordsTable().getByRole("row")).toHaveCount(3);

  await page.goto("/route53/v2/hostedzones");
  await page.getByPlaceholder("Filter hosted zones by property or value").fill(`req-${RUN}`);
  await expect(zonesTable().getByRole("link")).toHaveCount(2);
  await page.getByRole("checkbox", { name: `Select ${ZONE}` }).check();
  await page.getByRole("checkbox", { name: `Select ${SECOND_ZONE}` }).check();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("list", { name: "Hosted zones to delete" })).toContainText(SECOND_ZONE);
  await page.screenshot({ path: `${EVIDENCE_DIR}/12-bulk-delete-zones.png` });
  await dialog.getByRole("textbox").fill("delete");
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(zonesTable().getByRole("link")).toHaveCount(0);
});

test("auth: logout", async () => {
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  const me = await page.request.get(api("/auth/me"));
  expect(me.status()).toBe(401);
});

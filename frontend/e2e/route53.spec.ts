import { expect, test, type Page } from "@playwright/test";

/**
 * One user journey through the console, run in order on a single page:
 * login → create zone → add A/MX/TXT → search → edit → delete record → delete zone → logout.
 */
test.describe.configure({ mode: "serial" });

const ZONE = `e2e-${Date.now()}.test`;
let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.afterAll(async () => {
  await page.close();
});

const recordsTable = () => page.getByRole("table").filter({ hasText: "Record name" });
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Each row is labelled "Select <record name> <type> ..." by its selection checkbox cell.
const recordRow = (name: string, type: string) =>
  recordsTable().getByRole("row", { name: new RegExp(`^Select ${escapeRegExp(name)} ${type} `) });

test("signs in with the demo account", async () => {
  await page.goto("/route53/v2/hostedzones");
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("IAM user name").fill("admin");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/route53\/v2\/hostedzones$/);
  await expect(page.getByRole("heading", { name: /Hosted zones/ })).toBeVisible();
});

test("creates a hosted zone", async () => {
  await page.getByRole("button", { name: "Create hosted zone" }).first().click();
  await page.getByRole("textbox", { name: "Domain name" }).fill(ZONE);
  await page.getByRole("button", { name: "Create hosted zone" }).last().click();

  await expect(page.getByText(`Hosted zone ${ZONE} was created successfully.`)).toBeVisible();
  await expect(page.getByRole("heading", { name: ZONE })).toBeVisible();
  await expect(recordsTable().getByRole("row")).toHaveCount(3); // header + default NS + SOA
});

test("adds A, MX and TXT records in one batch", async () => {
  await page.getByRole("button", { name: "Create record" }).click();
  await expect(page.getByRole("heading", { name: "Quick create record" })).toBeVisible();

  await page.getByRole("button", { name: "Add another record" }).click();
  await page.getByRole("button", { name: "Add another record" }).click();

  const rows = [
    { name: "www", type: "A", value: "192.0.2.10" },
    { name: "", type: "MX", value: `10 mail.${ZONE}` },
    { name: "", type: "TXT", value: '"v=spf1 -all"' },
  ];
  for (const [index, row] of rows.entries()) {
    if (row.name) await page.getByRole("textbox", { name: "Record name" }).nth(index).fill(row.name);
    if (row.type !== "A") {
      await page.getByRole("button", { name: /Record type/ }).nth(index).click();
      await page.getByRole("option", { name: new RegExp(`^${row.type}\\b`) }).click();
    }
    await page.getByRole("textbox", { name: "Value", exact: true }).nth(index).fill(row.value);
  }
  await page.getByRole("button", { name: "Create records" }).click();

  await expect(page.getByText(`Successfully created 3 records in ${ZONE}.`)).toBeVisible();
  await expect(recordRow(`www.${ZONE}`, "A")).toBeVisible();
  await expect(recordRow(ZONE, "MX")).toBeVisible();
  await expect(recordRow(ZONE, "TXT")).toBeVisible();
});

test("searches records", async () => {
  const filter = page.getByPlaceholder("Filter records by property or value");
  await filter.fill("spf1");

  await expect(recordsTable().getByRole("row")).toHaveCount(2);
  await expect(recordRow(ZONE, "TXT")).toBeVisible();
  await expect(page.getByText("1 match", { exact: true }).first()).toBeVisible();

  await filter.fill("");
  await expect(recordsTable().getByRole("row")).toHaveCount(6);
});

test("edits a record in the split panel", async () => {
  await recordRow(`www.${ZONE}`, "A").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Edit record" }).click();

  const value = page.getByRole("textbox", { name: "Value", exact: true });
  await value.fill("192.0.2.20");
  await page.getByRole("spinbutton", { name: "TTL (seconds)" }).fill("600");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(page.getByText(`Record www.${ZONE} (A) was updated successfully.`)).toBeVisible();
  const row = recordRow(`www.${ZONE}`, "A");
  await expect(row).toContainText("192.0.2.20");
  await expect(row).toContainText("600");
});

test("deletes the records", async () => {
  for (const [name, type] of [
    [`www.${ZONE}`, "A"],
    [ZONE, "MX"],
    [ZONE, "TXT"],
  ]) {
    await recordRow(name, type).getByRole("checkbox").check();
  }
  await page.getByRole("button", { name: "Delete record" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Are you sure that you want to delete");
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(dialog).toBeHidden();
  await expect(recordsTable().getByRole("row")).toHaveCount(3);
});

test("deletes the hosted zone", async () => {
  await page.getByRole("button", { name: "Delete zone" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("delete");
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page).toHaveURL(/\/route53\/v2\/hostedzones$/);
  await expect(page.getByRole("link", { name: ZONE, exact: true })).toHaveCount(0);
});

test("signs out", async () => {
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/login/);
  await page.goto("/route53/v2/hostedzones");
  await expect(page).toHaveURL(/\/login/);
});

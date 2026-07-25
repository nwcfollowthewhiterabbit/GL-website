import "dotenv/config";
import { setWebsiteCustomerPassword } from "../api/account-service.mjs";
import { getErpPool } from "../api/erpnext-db.mjs";
import { createDoc, listDoc } from "../api/erpnext-rest.mjs";

const email = String(process.env.ACCOUNT_TEST_LOGIN_EMAIL || "customer-demo@example.com").trim().toLowerCase();
const itemCode = String(process.env.ACCOUNT_TEST_ITEM_CODE || "PAC-DM868-A").trim();
const company = process.env.ERP_COMPANY || "Green Leaf Ltd";
const currency = process.env.DEFAULT_CURRENCY || "FJD";
const priceList = process.env.DEFAULT_PRICE_LIST || "Standard Selling";
const today = new Date().toISOString().slice(0, 10);

function futureDate(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function first(doctype, filters, fields) {
  return (await listDoc(doctype, { filters, fields, limit: 1 }))[0] || null;
}

async function ensureCustomer() {
  const existing = await first("Customer", [["email_id", "=", email]], ["name", "customer_name", "email_id"]);
  if (existing) return existing;

  return createDoc("Customer", {
    customer_name: "Green Leaf Website Test Customer",
    customer_type: "Company",
    customer_group: process.env.ERP_CUSTOMER_GROUP || "Individual",
    territory: process.env.ERP_TERRITORY || "Nadi, Lautoka",
    email_id: email,
    mobile_no: "+679 000 0000"
  });
}

async function itemLine() {
  const item = await first("Item", [["name", "=", itemCode]], ["name", "item_name", "stock_uom"]);
  if (!item) throw new Error(`Test item ${itemCode} was not found`);

  const rate = Number(process.env.ACCOUNT_TEST_ITEM_RATE || 2030);
  return { item_code: item.name, qty: 2, rate };
}

async function ensureQuotation(customer, line) {
  const existing = await first(
    "Quotation",
    [["website_customer_email", "=", email], ["enq_det", "like", "%Website test account fixture%"]],
    ["name", "status", "grand_total"]
  );
  if (existing) return existing;

  return createDoc("Quotation", {
    quotation_to: "Customer",
    party_name: customer.name,
    company,
    transaction_date: today,
    valid_till: futureDate(30),
    currency,
    selling_price_list: priceList,
    order_type: "Sales",
    website_customer_email: email,
    website_source: "greenleaf-test-account",
    enq_det: "Website test account fixture\nSynthetic data for customer account testing.",
    items: [line]
  });
}

async function ensureSalesOrder(customer, line) {
  const existing = await first(
    "Sales Order",
    [["customer", "=", customer.name], ["po_no", "=", "WEBSITE-ACCOUNT-DEMO"]],
    ["name", "status", "grand_total"]
  );
  if (existing) return existing;

  return createDoc("Sales Order", {
    customer: customer.name,
    company,
    transaction_date: today,
    delivery_date: futureDate(14),
    currency,
    selling_price_list: priceList,
    order_type: "Sales",
    po_no: "WEBSITE-ACCOUNT-DEMO",
    items: [line]
  });
}

async function ensureSalesInvoice(customer, line) {
  const existing = await first(
    "Sales Invoice",
    [["customer", "=", customer.name], ["po_no", "=", "WEBSITE-ACCOUNT-DEMO"]],
    ["name", "status", "grand_total", "outstanding_amount"]
  );
  if (existing) return existing;

  return createDoc("Sales Invoice", {
    customer: customer.name,
    company,
    posting_date: today,
    due_date: futureDate(30),
    currency,
    selling_price_list: priceList,
    po_no: "WEBSITE-ACCOUNT-DEMO",
    update_stock: 0,
    items: [line]
  });
}

async function main() {
  const password = String(process.env.ACCOUNT_TEST_PASSWORD || "");
  if (password.length < 10) throw new Error("ACCOUNT_TEST_PASSWORD must contain at least 10 characters");

  const customer = await ensureCustomer();
  const line = await itemLine();
  const quotation = await ensureQuotation(customer, line);
  const order = await ensureSalesOrder(customer, line);
  const invoice = process.env.ACCOUNT_TEST_CREATE_INVOICE === "true"
    ? await ensureSalesInvoice(customer, line)
    : null;
  const credential = await setWebsiteCustomerPassword({
    customer: customer.name,
    email,
    password
  });
  if (!credential.ok) {
    throw new Error(
      `Unable to create website credential: ${credential.error}. Provision the Website User, Website Customer role, Contact, and Customer link in ERPNext first.`
    );
  }

  console.log(`Test account customer: ${customer.name}`);
  console.log(`Quotation: ${quotation.name} (${quotation.status || "Draft"})`);
  console.log(`Sales Order: ${order.name} (${order.status || "Draft"})`);
  console.log(invoice
    ? `Sales Invoice: ${invoice.name} (${invoice.status || "Draft"})`
    : "Sales Invoice: skipped (integration user has no invoice permission)");
  console.log(`Website login: ${credential.email}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getErpPool().end();
  });

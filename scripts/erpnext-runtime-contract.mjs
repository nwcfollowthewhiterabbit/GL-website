import assert from "node:assert/strict";

const baseUrl = (process.env.ERP_RUNTIME_BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
const itemCode = process.env.ERP_RUNTIME_ITEM_CODE || "GL-WEB-E2E-ITEM-001";
const requestId = process.env.ERP_RUNTIME_QUOTE_ID || "GL-WEB-E2E-V16-CONTRACT-001";

async function json(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  assert.ok(response.ok, `${path} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

function quotationName(result) {
  return typeof result.quotation === "string" ? result.quotation : result.quotation?.name;
}

const health = await json("/health");
assert.equal(health.ok, true);

const catalog = await json(`/api/catalog/product?sku=${encodeURIComponent(itemCode)}`);
assert.equal(catalog.product?.sku, itemCode);
assert.equal(catalog.product?.currency, "FJD");
assert.ok(Number(catalog.product?.price) > 0);

const payload = {
  id: requestId,
  customer: {
    company: "GL-WEB-E2E-CUSTOMER",
    contact: "Compatibility Buyer",
    email: "quote-v16@example.invalid",
    phone: "+679 000 0000",
    location: "Nadi Test Address"
  },
  lines: [{ sku: itemCode, qty: 2 }],
  notes: "Synthetic ERPNext compatibility contract"
};
const request = {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
};
const first = await json("/api/quote-requests", request);
const second = await json("/api/quote-requests", request);

assert.ok(["created", "idempotent"].includes(first.mode));
assert.equal(second.mode, "idempotent");
assert.ok(quotationName(first));
assert.equal(quotationName(second), quotationName(first));
assert.equal(first.validLines?.[0]?.rate, 125);

console.log(`ERPNext runtime contract passed: ${quotationName(first)}.`);

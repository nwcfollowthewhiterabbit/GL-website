import assert from "node:assert/strict";

const baseUrl = (process.env.ERP_RUNTIME_BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
const itemCode = process.env.ERP_RUNTIME_ITEM_CODE || "GL-WEB-E2E-ITEM-001";
const requestId = process.env.ERP_RUNTIME_QUOTE_ID || "GL-WEB-E2E-V16-CONTRACT-001";
const email = process.env.ACCOUNT_TEST_LOGIN_EMAIL || "gl-web-e2e@example.invalid";
const password = process.env.ACCOUNT_TEST_PASSWORD || "";

assert.ok(password.length >= 10, "ACCOUNT_TEST_PASSWORD is required for the isolated customer fixture");

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
const { uom, packingUnit } = catalog.product;
assert.ok(uom);
assert.equal("currency" in catalog.product || "price" in catalog.product, false);
const qty = 2 * Math.max(1, Number(packingUnit || 1));
const login = await fetch(baseUrl + "/api/account/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password })
});
assert.equal(login.status, 200, "Isolated customer fixture sign-in failed");
const cookie = login.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie?.startsWith("gl_account_session="), "Isolated customer fixture requires a session");

const payload = {
  id: requestId,
  customer: {
    company: "GL-WEB-E2E-CUSTOMER",
    contact: "Compatibility Buyer",
    email,
    phone: "+679 000 0000",
    location: "Nadi Test Address"
  },
  lines: [{ sku: itemCode, uom, qty }],
  notes: "Synthetic ERPNext compatibility contract"
};
const request = {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify(payload)
};
try {
  const first = await json("/api/quote-requests", request);
  const second = await json("/api/quote-requests", request);
  assert.ok(["created", "idempotent"].includes(first.mode));
  assert.equal(second.mode, "idempotent");
  assert.ok(quotationName(first));
  assert.equal(quotationName(second), quotationName(first));
  for (const result of [first, second]) {
    assert.deepEqual(result.validLines.map(line => [line.item_code, line.qty, line.uom]), [[itemCode, qty, uom]]);
    assert.equal("rate" in result.validLines[0] || "amount" in result.validLines[0], false);
    assert.equal("grand_total" in Object(result.quotation) || "grandTotal" in Object(result.quotation), false);
  }
  console.log(`ERPNext runtime contract passed for ${quotationName(first)}.`);
} finally {
  await json("/api/account/logout", { method: "POST", headers: { Cookie: cookie } });
}

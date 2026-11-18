import assert from "node:assert/strict";
import { bindQuoteToAccount, validQuoteLines, createQuoteRequest, quoteRequestFingerprint, resolveSellingLines } from "../api/quote-service.mjs";
import { accountHistoryPage, accountHistoryResult } from "../api/account-history.mjs";

const account = { email: "buyer@example.com", customer: "Customer-verified" };
const payload = { customer: { company: "Buyer company", email: "BUYER@example.com", customer: "Customer-other" }, lines: [{ sku: "SKU-1", qty: 2 }] };
assert.equal(bindQuoteToAccount(payload, null).error, "not_authenticated");
assert.equal(bindQuoteToAccount(payload, { email: account.email }).error, "not_authenticated");
assert.equal(bindQuoteToAccount(payload, account).payload.customer.email, account.email);
assert.equal(bindQuoteToAccount({ customer: { email: "other@example.com" } }, account).error, "account_email_mismatch");
assert.equal(bindQuoteToAccount({ customer: {} }, account).payload.customer.email, account.email);
assert.equal((await createQuoteRequest({ ...payload, customer: { ...payload.customer, email: "other@example.com" } }, account)).error, "account_email_mismatch");
for (const lines of [[], null, [null], [{ sku: "SKU-1", qty: 0 }], [{ sku: "SKU-1", qty: -1 }], [{ sku: "SKU-1", qty: 1001 }], [{ sku: "SKU-1", qty: "bad" }], [{ sku: "SKU-1", qty: 1 }, { sku: "SKU-1", qty: 1 }]]) {
  assert.equal(validQuoteLines(lines), false, `invalid cart must fail: ${JSON.stringify(lines)}`);
}
assert.equal(validQuoteLines([{ sku: "SKU-1", qty: 1 }, { sku: "SKU-2", qty: 1000 }]), true);
assert.deepEqual(accountHistoryPage({ limit: "-5", offset: "1.7" }), { limit: 20, offset: 0 });
assert.deepEqual(accountHistoryPage({ limit: "1000", offset: "20" }), { limit: 50, offset: 20 });
assert.deepEqual(accountHistoryResult("orders", [1, 2, 3], { limit: 2, offset: 4 }), { orders: [1, 2], hasMore: true, nextOffset: 6 });
assert.deepEqual(accountHistoryResult("quotes", [1], { limit: 2, offset: 4 }), { quotes: [1], hasMore: false, nextOffset: null });
console.log("Customer quote identity, strict cart validation and history paging contracts passed.");

const sku = "REW-3445731";
const small = { sku, uom: "50/Case", qty: 1, expectedRate: 9.25 };
const large = { sku, uom: "1000/Case", qty: 1, expectedRate: 236.16 };
const offers = new Map([[sku, [small, large].map((line) => ({
  sku, uom: line.uom, price: line.expectedRate, item_name: "Sauce Cup-50/case",
  stock_uom: "Case", sales_uom: "50/Case", conversion_factor: 1, available_quantity: 10
}))]]);
for (const lines of [[small, large], [large, small]]) {
  assert(validQuoteLines(lines));
  const result = resolveSellingLines(lines, offers);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.validLines.map(({ uom, rate }) => [uom, rate]), lines.map((line) => [line.uom, line.expectedRate]));
  assert.equal(result.validLines.reduce((total, line) => total + Math.round(line.rate * line.qty * 100), 0), 24541);
  assert.equal(result.validLines.find((line) => line.uom === large.uom).item_name, "Sauce Cup-1000/Case");
}
assert(!validQuoteLines([small, small]));
assert.notEqual(quoteRequestFingerprint({ ...payload, id: "stable", lines: [small] }), quoteRequestFingerprint({ ...payload, id: "stable", lines: [large] }));
assert.equal(resolveSellingLines([{ sku, qty: 1 }], offers).missing[0].reason, "selling_unit_unavailable");
assert.equal(resolveSellingLines([{ ...large, uom: "unlisted" }], offers).missing[0].reason, "selling_unit_unavailable");
assert.equal(resolveSellingLines([{ ...large, expectedRate: 9.25 }], offers).missing[0].reason, "price_changed");
const single = new Map([[sku, [{ ...offers.get(sku)[0], conversion_factor: 5, available_quantity: 6 }]]]);
assert.equal(resolveSellingLines([{ sku, qty: 2 }], single).validLines[0].fulfillmentStatus, "low_stock");
assert.equal(resolveSellingLines([{ sku, qty: 1 }, small], single).missing[0].reason, "duplicate_selling_unit");
console.log("Selling units, pack rates, stock conversion, old baskets and replay identity passed.");

const six = new Map([["LUZ-AK6110034", [{
  item_name: "Item", uom: "Each", conversion_factor: 1, packing_unit: 6,
  price: 55.41, sales_uom: "Each", stock_uom: "Each", available_quantity: 49
}]]]);
const multiple = { sku: "LUZ-AK6110034", uom: "Each", qty: 6, expectedRate: 55.41 };
assert.equal(resolveSellingLines([{ ...multiple, qty: 1 }], six).missing[0].reason, "invalid_pack_quantity");
const soldBySix = resolveSellingLines([multiple], six).validLines[0];
assert.equal(soldBySix.qty, 6);
assert.equal(Math.round(soldBySix.qty * soldBySix.rate * 100), 33246);

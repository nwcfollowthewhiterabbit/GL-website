import assert from "node:assert/strict";
import { bindQuoteToAccount, validQuoteLines, createQuoteRequest } from "../api/quote-service.mjs";
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

import assert from "node:assert/strict";
import express from "express";
import { cachePublicRead } from "../api/public-read-cache.mjs";
import { gzipSync } from "node:zlib";
import { JSON_BODY_OPTIONS } from "../api/security.mjs";

process.env.ACCOUNT_SESSION_SECRET = "integration-contract-secret-at-least-32-characters";
process.env.PAYMENT_ENABLED = "true";
process.env.PAYMENT_API_BASE_URL = "https://uat.windcave.com/api/v1";
process.env.PAYMENT_API_USERNAME = "uat-user";
process.env.PAYMENT_API_KEY = "uat-key";
process.env.STORE_PUBLIC_URL = "https://testing.greenleafpacific.com";
process.env.PAYMENT_PAYABLE_DOCTYPE = "Sales Invoice";
process.env.PAYMENT_AMOUNT_MODE = "outstanding_total";
process.env.PAYMENT_ERP_WRITE_ENABLED = "true";
process.env.ERP_PAYMENT_MODE_OF_PAYMENT = "Credit Card";
process.env.ERP_PAYMENT_PAID_FROM = "Debtors - GL";
process.env.ERP_PAYMENT_PAID_TO = "Windcave Clearing - GL";
process.env.ERPNEXT_API_KEY = "test-api-key";
process.env.ERPNEXT_API_SECRET = "test-api-secret";

const { isDocumentWithinCustomerAccess } = await import("../api/account-service.mjs");
const { verifyWindcaveNotification } = await import("../api/payment-service.mjs");
const {
  buildPaymentEntry,
  paymentSessionMatchesEvent
} = await import("../api/payment-orchestration-service.mjs");
const { websiteMigrationIds } = await import("../api/migrations/runner.mjs");
const { normalizeQuoteRequestId, quoteMarkerFromId, trustedQuoteRate, quoteLookupSql, quoteRequestFingerprint, quoteReplayMatches, coalesceQuoteRequest, withQuoteRequestLock } = await import("../api/quote-service.mjs");
const {
  applyStorefrontFallbackPolicy,
  createStorefrontDiagnostics
} = await import("../api/storefront-fallback-policy.mjs");

// Concurrent consumers share a single read. Rejected and expired reads remain retryable.
let publicReads = 0;
const cachedRead = cachePublicRead(async () => {
  publicReads += 1;
  if (publicReads === 1) throw new Error("temporary catalog outage");
  return publicReads;
}, 60_000);
await assert.rejects(Promise.all([cachedRead(), cachedRead()]), /temporary catalog outage/);
assert.deepEqual(await Promise.all([cachedRead(), cachedRead(), cachedRead()]), [2, 2, 2]);
assert.equal(await cachedRead(), 2);
const expiredRead = cachePublicRead(async () => ++publicReads, 0);
assert.deepEqual(await Promise.all([expiredRead(), expiredRead()]), [3, 3]);
assert.equal(await expiredRead(), 4);

const buyerAccess = {
  email: "buyer@example.com",
  customerNames: ["CUS-0001"]
};
assert.equal(
  isDocumentWithinCustomerAccess({ customer: "CUS-0001" }, buyerAccess),
  true,
  "linked customer documents must be visible"
);
assert.equal(
  isDocumentWithinCustomerAccess({ websiteCustomerEmail: "BUYER@example.com" }, buyerAccess),
  true,
  "email-scoped quotations must be visible"
);
assert.equal(
  isDocumentWithinCustomerAccess({ customer: "CUS-0002", websiteCustomerEmail: "other@example.com" }, buyerAccess),
  false,
  "another customer's documents must remain isolated"
);

assert.equal(normalizeQuoteRequestId(" GLQ/123% "), "GLQ-123");
assert.equal(quoteMarkerFromId("GLQ/123%"), "Green Leaf Website Quote #GLQ-123");
assert.equal(
  trustedQuoteRate({ price: 52.75, rate: 0.01 }),
  52.75,
  "quote prices must come from the trusted ERP price"
);

const quoteRequest = {
  id: "GLQ-A_B", customer: { company: "Example", contact: "Buyer", email: "buyer@example.com", phone: "123", location: "Nadi" },
  lines: [{ sku: "ITEM-1", qty: 2 }], notes: "Please confirm"
};
const existingQuote = { website_customer_email: "buyer@example.com", website_payload: JSON.stringify(quoteRequest) };
assert.equal(quoteReplayMatches(existingQuote, quoteRequest), true);
assert.equal(quoteReplayMatches(existingQuote, { ...quoteRequest, id: "GLQ-A" }), false, "a request ID prefix must not replay another quote");
assert.equal(quoteReplayMatches(existingQuote, { ...quoteRequest, customer: { ...quoteRequest.customer, email: "other@example.com" } }), false);
assert.equal(quoteReplayMatches(existingQuote, { ...quoteRequest, lines: [{ sku: "ITEM-1", qty: 3 }] }), false);
assert.equal(quoteReplayMatches(existingQuote, { ...quoteRequest, notes: "Changed terms" }), false);
assert.equal(quoteReplayMatches({ website_payload: "invalid-json" }, quoteRequest), false);
assert.equal(quoteReplayMatches({ website_payload: null }, quoteRequest), false, "unbound legacy requests must fail closed");
assert.notEqual(quoteRequestFingerprint(quoteRequest), quoteRequestFingerprint({ ...quoteRequest, customer: { ...quoteRequest.customer, email: "other@example.com" } }));
for (const fields of [{ website_quote_id: true, website_payload: true, website_customer_email: true }, {}]) {
  const query = quoteLookupSql(fields);
  assert.ok(!query.includes("LIKE"), "underscore request IDs must never become SQL wildcards");
  assert.ok(query.includes("SUBSTRING_INDEX(enq_det, CHAR(10), 1) = :marker"));
  assert.ok(query.includes("LIMIT 2"), "ambiguous legacy matches must be detected");
}
assert.ok(quoteLookupSql({ website_quote_id: true }).includes("website_quote_id = :id"));
let releaseQuote;
let operations = 0;
const quoteOperation = () => { operations += 1; return new Promise((resolve) => { releaseQuote = resolve; }); };
const firstQuote = coalesceQuoteRequest(quoteRequest, quoteOperation);
const sameQuote = coalesceQuoteRequest(quoteRequest, quoteOperation);
const conflictingQuote = await coalesceQuoteRequest({ ...quoteRequest, customer: { ...quoteRequest.customer, email: "other@example.com" } }, quoteOperation);
assert.equal(conflictingQuote.error, "request_id_conflict");
assert.equal(conflictingQuote.quotation, undefined, "a conflict must not disclose the first quotation");
const caseConflict = await coalesceQuoteRequest({ ...quoteRequest, id: quoteRequest.id.toLowerCase() }, quoteOperation);
assert.equal(caseConflict.error, "request_id_conflict", "case aliases sharing the ERP unique key must not create concurrent writes");
assert.equal(operations, 1);
releaseQuote({ quotation: "QTN-TEST" });
assert.deepEqual(await firstQuote, await sameQuote);
const lockCalls = [];
const lockConnection = {
  execute: async (sql) => { lockCalls.push(sql); return [[{ acquired: 1 }]]; },
  end: async () => { lockCalls.push("end"); }
};
await assert.rejects(withQuoteRequestLock("GLQ-lock", async () => { throw new Error("simulated-failure"); }, async () => lockConnection), /simulated-failure/);
assert.deepEqual(lockCalls, ["SELECT GET_LOCK(?, 30) AS acquired", "SELECT RELEASE_LOCK(?)", "end"]);
let ranBusyOperation = false;
await assert.rejects(withQuoteRequestLock("GLQ-busy", async () => { ranBusyOperation = true; }, async () => ({
  execute: async () => [[{ acquired: 0 }]], end: async () => undefined
})), /quote_request_busy/);
assert.equal(ranBusyOperation, false);

const bodyApp = express();
let bodyHandlerCalls = 0;
bodyApp.use(express.json(JSON_BODY_OPTIONS));
bodyApp.post("/json", (_req, res) => { bodyHandlerCalls += 1; res.json({ ok: true }); });
bodyApp.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: "body_rejected" }));
const bodyServer = await new Promise((resolve) => {
  const server = bodyApp.listen(0, "127.0.0.1", () => resolve(server));
});
try {
  const bodyUrl = `http://127.0.0.1:${bodyServer.address().port}/json`;
  const plainResponse = await fetch(bodyUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) });
  assert.equal(plainResponse.status, 200);
  const compressedResponse = await fetch(bodyUrl, { method: "POST", headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" }, body: gzipSync(JSON.stringify({ ok: true })) });
  assert.equal(compressedResponse.status, 415, "compressed JSON must be rejected before decompression");
  assert.equal(bodyHandlerCalls, 1, "rejected compressed data must not reach business handlers");
} finally {
  await new Promise((resolve, reject) => bodyServer.close((error) => error ? reject(error) : resolve()));
}

const approvedNotification = await verifyWindcaveNotification(
  { sessionId: "00001200030240010c9e7ceadd26a6d8", state: "declined" },
  async () =>
    new Response(
      JSON.stringify({
        id: "00001200030240010c9e7ceadd26a6d8",
        state: "complete",
        merchantReference: "QTN-2026-00001",
        amount: "125.50",
        currency: "FJD",
        transactions: [{ id: "txn-1", authorised: true, reCo: "00", responseText: "APPROVED" }]
      }),
      { status: 200 }
    )
);
assert.equal(approvedNotification.outcome, "approved");
assert.equal(
  approvedNotification.session.authorised,
  true,
  "notification outcome must come from the authenticated Windcave query"
);

await assert.rejects(
  verifyWindcaveNotification(
    { id: "00001200030240010c9e7ceadd26a6d8" },
    async () => new Response(JSON.stringify({ error: "temporary outage" }), { status: 503 })
  ),
  (error) => error.code === "windcave_request_failed"
);

const warnedFallback = applyStorefrontFallbackPolicy(
  { source: "fallback_static_hero_banners", banners: [] },
  "banners",
  "warn"
);
assert.equal(warnedFallback.fallback.degraded, true);
assert.throws(
  () =>
    applyStorefrontFallbackPolicy(
      { source: "erp_website_banner_empty", banners: [] },
      "banners",
      "deny"
    ),
  (error) => error.code === "storefront_fallback_denied"
);

const diagnostics = createStorefrontDiagnostics(
  {
    departments: { source: "erp_website_department" },
    banners: { source: "fallback_static_hero_banners" }
  },
  "warn"
);
assert.equal(diagnostics.healthy, false);
assert.equal(diagnostics.resources.departments.status, "erp");

const paymentEvent = {
  request_id: "GL-WEB-PAYMENT-0001",
  payable_doctype: "Sales Invoice",
  payable_name: "SINV-0001",
  customer: "CUS-0001",
  company: "Green Leaf Ltd",
  amount: "125.50",
  grand_total: "125.50",
  outstanding_amount: "125.50",
  currency: "FJD"
};
assert.equal(
  paymentSessionMatchesEvent(
    { reference: paymentEvent.request_id, amount: "125.50", currency: "FJD" },
    paymentEvent
  ),
  true
);
assert.equal(
  paymentSessionMatchesEvent(
    { reference: paymentEvent.request_id, amount: "125.51", currency: "FJD" },
    paymentEvent
  ),
  false
);
const paymentEntry = buildPaymentEntry(paymentEvent, "txn-1", {
  erp: {
    modeOfPayment: "Credit Card",
    paidFrom: "Debtors - GL",
    paidTo: "Windcave Clearing - GL"
  }
});
assert.equal(paymentEntry.reference_no, "txn-1");
assert.equal(paymentEntry.references[0].reference_name, "SINV-0001");
assert.equal(paymentEntry.references[0].allocated_amount, 125.5);
assert.deepEqual(websiteMigrationIds(), [
  "001-website-customer-credentials",
  "002-website-payment-event",
  "003-website-account-challenge",
  "004-website-session-revocation"
]);

console.log("Integration contract tests passed.");

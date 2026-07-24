import assert from "node:assert/strict";

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
const { normalizeQuoteRequestId, quoteMarkerFromId } = await import("../api/quote-service.mjs");
const {
  applyStorefrontFallbackPolicy,
  createStorefrontDiagnostics
} = await import("../api/storefront-fallback-policy.mjs");

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
  "002-website-payment-event"
]);

console.log("Integration contract tests passed.");

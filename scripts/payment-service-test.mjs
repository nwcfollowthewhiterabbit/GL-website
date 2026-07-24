import assert from "node:assert/strict";
import {
  createWindcaveHostedSession,
  getPaymentConfig,
  queryWindcaveHostedSession
} from "../api/payment-service.mjs";

process.env.PAYMENT_ENABLED = "false";
process.env.PAYMENT_API_BASE_URL = "";
process.env.PAYMENT_API_USERNAME = "";
process.env.PAYMENT_API_KEY = "";
process.env.STORE_PUBLIC_URL = "https://testing.greenleafpacific.com";

const disabled = getPaymentConfig();
assert.equal(disabled.provider, "windcave");
assert.equal(disabled.integration, "hosted_payment_page");
assert.equal(disabled.currency, "FJD");
assert.equal(disabled.enabled, false);
assert.equal(disabled.environment, "unconfigured");
assert.equal(disabled.erpConfigured, false);
assert.equal("paidFrom" in disabled.erp, false);
assert.equal("paidTo" in disabled.erp, false);
assert.deepEqual(disabled.cardBrands, ["visa", "mastercard", "american_express"]);

process.env.PAYMENT_ENABLED = "true";
process.env.PAYMENT_API_BASE_URL = "https://uat.windcave.com/api/v1";
process.env.PAYMENT_API_USERNAME = "uat-user";
process.env.PAYMENT_API_KEY = "uat-key";
process.env.PAYMENT_PAYABLE_DOCTYPE = "Sales Invoice";
process.env.PAYMENT_AMOUNT_MODE = "outstanding_total";
process.env.PAYMENT_ERP_WRITE_ENABLED = "true";
process.env.ERP_PAYMENT_MODE_OF_PAYMENT = "Credit Card";
process.env.ERP_PAYMENT_PAID_FROM = "Debtors - GL";
process.env.ERP_PAYMENT_PAID_TO = "Windcave Clearing - GL";
process.env.ERPNEXT_API_KEY = "test-api-key";
process.env.ERPNEXT_API_SECRET = "test-api-secret";

let createRequest;
const created = await createWindcaveHostedSession(
  {
    reference: "QTN-2026-00001",
    amount: 125.5,
    customer: { email: "BUYER@EXAMPLE.COM", phone: "+679 700 0000" }
  },
  async (url, options) => {
    createRequest = { url, options, body: JSON.parse(options.body) };
    return new Response(
      JSON.stringify({
        id: "00001200030240010c9e7ceadd26a6d8",
        state: "init",
        links: [
          { rel: "self", href: "https://uat.windcave.com/api/v1/sessions/00001200030240010c9e7ceadd26a6d8" },
          { rel: "hpp", href: "https://uat.windcave.com/pxmi3/example" }
        ]
      }),
      { status: 202 }
    );
  }
);

assert.equal(createRequest.url, "https://uat.windcave.com/api/v1/sessions");
assert.equal(createRequest.options.method, "POST");
assert.equal(createRequest.body.type, "purchase");
assert.equal(createRequest.body.amount, "125.50");
assert.equal(createRequest.body.currency, "FJD");
assert.equal(createRequest.body.customer.email, "buyer@example.com");
assert.equal(createRequest.body.callbackUrls.approved, "https://testing.greenleafpacific.com/payment/approved");
assert.equal(created.hppUrl, "https://uat.windcave.com/pxmi3/example");

const queried = await queryWindcaveHostedSession(created.id, async () =>
  new Response(
    JSON.stringify({
      id: created.id,
      state: "complete",
      amount: "125.50",
      currency: "FJD",
      merchantReference: "QTN-2026-00001",
      transactions: [{ id: "txn-1", authorised: true, reCo: "00", responseText: "APPROVED" }]
    }),
    { status: 200 }
  )
);

assert.equal(queried.authorised, true);
assert.equal(queried.transactionId, "txn-1");
assert.equal(queried.reference, "QTN-2026-00001");

console.log("Windcave payment adapter checks passed");

import crypto from "node:crypto";
import { getErpPool } from "./erpnext-db.mjs";
import { createDoc, listDoc, submitDoc } from "./erpnext-rest.mjs";
import { resolveCustomerAccessByEmail } from "./account-service.mjs";
import {
  createWindcaveHostedSession,
  getPaymentConfig,
  getPaymentRuntimeConfig,
  verifyWindcaveNotification
} from "./payment-service.mjs";
import { assertWebsiteMigrationsApplied } from "./migrations/runner.mjs";

const PAYMENT_EVENT_TABLE = "tabWebsite Payment Event";

function clean(value) {
  return String(value || "").trim();
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function stableName(value) {
  return `website-payment-${crypto.createHash("sha256").update(value).digest("hex").slice(0, 24)}`;
}

function validRequestId(value) {
  const id = clean(value);
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(id) ? id : "";
}

export function paymentSessionMatchesEvent(session, event) {
  return Boolean(
    session &&
      event &&
      clean(session.reference) === clean(event.request_id) &&
      clean(session.currency).toUpperCase() === clean(event.currency).toUpperCase() &&
      Number(session.amount).toFixed(2) === Number(event.amount).toFixed(2)
  );
}

export function buildPaymentEntry(event, transactionId, config = getPaymentRuntimeConfig()) {
  if (event.payable_doctype !== "Sales Invoice") {
    const error = new Error("Only Sales Invoice allocation is supported");
    error.code = "unsupported_payable_doctype";
    throw error;
  }
  return {
    payment_type: "Receive",
    party_type: "Customer",
    party: event.customer,
    company: event.company,
    posting_date: new Date().toISOString().slice(0, 10),
    mode_of_payment: config.erp.modeOfPayment,
    paid_from: config.erp.paidFrom,
    paid_to: config.erp.paidTo,
    paid_amount: Number(event.amount),
    received_amount: Number(event.amount),
    source_exchange_rate: 1,
    target_exchange_rate: 1,
    reference_no: transactionId,
    reference_date: new Date().toISOString().slice(0, 10),
    remarks: `Windcave HPP payment for ${event.payable_name}`,
    references: [
      {
        reference_doctype: event.payable_doctype,
        reference_name: event.payable_name,
        total_amount: Number(event.grand_total),
        outstanding_amount: Number(event.outstanding_amount),
        allocated_amount: Number(event.amount)
      }
    ]
  };
}

async function payableInvoiceForCustomer(email, name) {
  const access = await resolveCustomerAccessByEmail(email);
  if (!access.customerNames.length) return null;
  const params = Object.fromEntries(access.customerNames.map((customer, index) => [`customer${index}`, customer]));
  params.name = clean(name);
  const placeholders = access.customerNames.map((_, index) => `:customer${index}`).join(", ");
  const [rows] = await getErpPool().execute(
    `
      SELECT name, customer, company, currency, grand_total, outstanding_amount, docstatus, status
      FROM \`tabSales Invoice\`
      WHERE name = :name
        AND customer IN (${placeholders})
      LIMIT 1
    `,
    params
  );
  const row = rows[0];
  if (!row || Number(row.docstatus) !== 1 || Number(row.outstanding_amount) <= 0) return null;
  return row;
}

async function eventBy(column, value) {
  await assertWebsiteMigrationsApplied();
  const allowed = new Set(["request_id", "provider_session_id"]);
  if (!allowed.has(column)) throw new Error("Unsupported payment event lookup");
  const [rows] = await getErpPool().execute(
    `SELECT * FROM \`${PAYMENT_EVENT_TABLE}\` WHERE \`${column}\` = :value LIMIT 1`,
    { value }
  );
  return rows[0] || null;
}

async function updateEvent(name, fields) {
  const entries = Object.entries(fields);
  if (!entries.length) return;
  const assignments = entries.map(([key]) => `\`${key}\` = :${key}`).join(", ");
  await getErpPool().execute(
    `UPDATE \`${PAYMENT_EVENT_TABLE}\` SET ${assignments}, modified = :modified WHERE name = :name`,
    { ...fields, modified: nowSql(), name }
  );
}

export async function createPaymentSessionForAccount(email, payload = {}, fetchImpl = fetch) {
  const config = getPaymentConfig();
  if (!config.enabled) {
    return { ok: false, error: "payment_flow_not_ready" };
  }
  const requestId = validRequestId(payload.requestId);
  if (!requestId) return { ok: false, error: "invalid_payment_request_id" };
  if (clean(payload.doctype) !== config.payableDoctype) {
    return { ok: false, error: "unsupported_payable_doctype" };
  }

  const existing = await eventBy("request_id", requestId);
  if (existing && clean(existing.customer_email).toLowerCase() !== clean(email).toLowerCase()) {
    return { ok: false, error: "invalid_payment_request_id" };
  }
  if (existing?.provider_session_id) {
    return {
      ok: true,
      reused: true,
      sessionId: existing.provider_session_id,
      hppUrl: existing.hpp_url,
      status: existing.status,
      expires: existing.expires_at
    };
  }

  const invoice = await payableInvoiceForCustomer(email, payload.name);
  if (!invoice) return { ok: false, error: "payable_document_not_found" };
  const amount = Number(invoice.outstanding_amount).toFixed(2);
  const now = nowSql();
  const name = stableName(requestId);
  const [insert] = await getErpPool().execute(
    `
      INSERT IGNORE INTO \`${PAYMENT_EVENT_TABLE}\`
        (name, creation, modified, request_id, provider, payable_doctype, payable_name, customer,
         customer_email, company, grand_total, original_outstanding_amount, amount, currency, status, effect_status)
      VALUES
        (:name, :now, :now, :requestId, 'windcave', :doctype, :payableName, :customer,
         :email, :company, :grandTotal, :outstandingAmount, :amount, :currency, 'creating', 'pending')
    `,
    {
      name,
      now,
      requestId,
      doctype: config.payableDoctype,
      payableName: invoice.name,
      customer: invoice.customer,
      email: clean(email).toLowerCase(),
      company: invoice.company,
      grandTotal: invoice.grand_total,
      outstandingAmount: invoice.outstanding_amount,
      amount,
      currency: invoice.currency
    }
  );
  if (Number(insert.affectedRows || 0) !== 1) {
    const current = await eventBy("request_id", requestId);
    if (current?.provider_session_id) {
      return {
        ok: true,
        reused: true,
        sessionId: current.provider_session_id,
        hppUrl: current.hpp_url,
        status: current.status,
        expires: current.expires_at
      };
    }
    return { ok: false, error: "payment_request_in_progress", retryable: true };
  }

  try {
    const session = await createWindcaveHostedSession(
      {
        reference: requestId,
        amount,
        customer: { email }
      },
      fetchImpl
    );
    await updateEvent(name, {
      provider_session_id: session.id,
      hpp_url: session.hppUrl,
      expires_at: session.expires.slice(0, 19).replace("T", " "),
      status: "pending",
      last_error: null
    });
    return {
      ok: true,
      sessionId: session.id,
      hppUrl: session.hppUrl,
      expires: session.expires,
      amount,
      currency: invoice.currency,
      payable: invoice.name
    };
  } catch (error) {
    await updateEvent(name, { status: "failed", last_error: error?.code || "windcave_session_failed" });
    throw error;
  }
}

async function existingPaymentEntry(transactionId) {
  const rows = await listDoc("Payment Entry", {
    filters: [["reference_no", "=", transactionId]],
    fields: ["name", "docstatus", "reference_no"],
    limit: 1
  });
  return rows[0] || null;
}

async function ensureSubmittedPaymentEntry(paymentEntry) {
  if (Number(paymentEntry.docstatus) === 1) return paymentEntry;
  return submitDoc("Payment Entry", paymentEntry.name);
}

async function currentPayableForEvent(event) {
  const invoice = await payableInvoiceForCustomer(event.customer_email, event.payable_name);
  if (
    !invoice ||
    invoice.customer !== event.customer ||
    invoice.company !== event.company ||
    clean(invoice.currency).toUpperCase() !== clean(event.currency).toUpperCase() ||
    Number(invoice.outstanding_amount) < Number(event.amount)
  ) {
    const error = new Error("Payable document is no longer eligible for this payment");
    error.code = "payable_document_changed";
    throw error;
  }
  return invoice;
}

export async function processWindcaveNotification(payload, fetchImpl = fetch) {
  const verified = await verifyWindcaveNotification(payload, fetchImpl);
  let event = await eventBy("provider_session_id", verified.session.id);
  if (!event && verified.session.reference) {
    event = await eventBy("request_id", verified.session.reference);
    if (event && !event.provider_session_id) {
      try {
        await updateEvent(event.name, { provider_session_id: verified.session.id });
        event = { ...event, provider_session_id: verified.session.id };
      } catch {
        event = await eventBy("provider_session_id", verified.session.id);
      }
    }
  }
  if (!event) {
    const error = new Error("Payment event was not found");
    error.code = "payment_event_not_found";
    throw error;
  }
  if (!paymentSessionMatchesEvent(verified.session, event)) {
    await updateEvent(event.name, { status: "verification_failed", last_error: "provider_result_mismatch" });
    const error = new Error("Provider result does not match the payable event");
    error.code = "provider_result_mismatch";
    throw error;
  }

  const payloadHash = crypto.createHash("sha256").update(JSON.stringify(verified.session)).digest("hex");
  await getErpPool().execute(
    `
      UPDATE \`${PAYMENT_EVENT_TABLE}\`
      SET callback_count = callback_count + 1,
          provider_payload_hash = :payloadHash,
          provider_transaction_id = COALESCE(provider_transaction_id, NULLIF(:transactionId, '')),
          status = :status,
          modified = :modified
      WHERE name = :name
    `,
    {
      payloadHash,
      transactionId: verified.session.transactionId,
      status: verified.outcome,
      modified: nowSql(),
      name: event.name
    }
  );

  if (verified.outcome !== "approved") {
    return { accepted: true, outcome: verified.outcome, effect: "not_required" };
  }
  if (!verified.session.transactionId) {
    const error = new Error("Approved provider result has no transaction id");
    error.code = "provider_transaction_missing";
    throw error;
  }

  const alreadyCreated = await existingPaymentEntry(verified.session.transactionId);
  if (alreadyCreated) {
    const submitted = await ensureSubmittedPaymentEntry(alreadyCreated);
    await updateEvent(event.name, {
      effect_status: "created",
      payment_entry: submitted.name,
      last_error: null
    });
    return { accepted: true, outcome: "approved", effect: "reused", paymentEntry: submitted.name };
  }

  const [claim] = await getErpPool().execute(
    `
      UPDATE \`${PAYMENT_EVENT_TABLE}\`
      SET effect_status = 'processing', modified = :modified
      WHERE name = :name AND effect_status IN ('pending', 'failed')
    `,
    { modified: nowSql(), name: event.name }
  );
  if (Number(claim.affectedRows || 0) !== 1) {
    return { accepted: true, outcome: "approved", effect: "processing" };
  }

  try {
    const invoice = await currentPayableForEvent(event);
    const draft = await createDoc(
      "Payment Entry",
      buildPaymentEntry(
        {
          ...event,
          grand_total: invoice.grand_total,
          outstanding_amount: invoice.outstanding_amount
        },
        verified.session.transactionId
      )
    );
    const paymentEntry = await ensureSubmittedPaymentEntry(draft);
    await updateEvent(event.name, {
      effect_status: "created",
      payment_entry: paymentEntry.name,
      last_error: null
    });
    return { accepted: true, outcome: "approved", effect: "created", paymentEntry: paymentEntry.name };
  } catch (error) {
    await updateEvent(event.name, { effect_status: "failed", last_error: error?.message || "payment_entry_failed" });
    throw error;
  }
}

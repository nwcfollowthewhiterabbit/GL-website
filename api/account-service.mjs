import crypto from "node:crypto";
import { getErpPool } from "./erpnext-db.mjs";

const loginCodes = new Map();
const sessions = new Map();
const CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function clean(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));
}

function now() {
  return Date.now();
}

function purgeExpired() {
  const time = now();
  for (const [email, entry] of loginCodes.entries()) {
    if (entry.expiresAt <= time) loginCodes.delete(email);
  }
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= time) sessions.delete(token);
  }
}

export function startAccountLogin(emailValue) {
  purgeExpired();
  const email = normalizeEmail(emailValue);
  if (!isValidEmail(email)) {
    return { ok: false, error: "invalid_email" };
  }

  const code = String(crypto.randomInt(100000, 999999));
  loginCodes.set(email, {
    codeHash: crypto.createHash("sha256").update(code).digest("hex"),
    expiresAt: now() + CODE_TTL_MS,
    attempts: 0
  });

  return {
    ok: true,
    email,
    expiresInSeconds: Math.floor(CODE_TTL_MS / 1000),
    delivery: process.env.ACCOUNT_EMAIL_PROVIDER ? "email" : "development_response",
    devCode: process.env.ACCOUNT_EMAIL_PROVIDER ? undefined : code
  };
}

export function verifyAccountLogin(emailValue, codeValue) {
  purgeExpired();
  const email = normalizeEmail(emailValue);
  const code = clean(codeValue);
  const entry = loginCodes.get(email);

  if (!entry) return { ok: false, error: "code_expired" };
  if (entry.attempts >= 5) {
    loginCodes.delete(email);
    return { ok: false, error: "too_many_attempts" };
  }

  entry.attempts += 1;
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");
  if (codeHash !== entry.codeHash) return { ok: false, error: "invalid_code" };

  loginCodes.delete(email);
  const token = crypto.randomBytes(32).toString("base64url");
  const session = {
    email,
    token,
    createdAt: new Date().toISOString(),
    expiresAt: now() + SESSION_TTL_MS
  };
  sessions.set(token, session);

  return {
    ok: true,
    token,
    email,
    expiresAt: new Date(session.expiresAt).toISOString()
  };
}

export function getAccountSession(req) {
  purgeExpired();
  const header = clean(req.headers.authorization);
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  return session;
}

export function endAccountSession(tokenValue) {
  const token = clean(tokenValue);
  if (token) sessions.delete(token);
}

export async function getCustomerProfileByEmail(emailValue) {
  const email = normalizeEmail(emailValue);
  if (!email) return null;

  const [rows] = await getErpPool().execute(
    `
      SELECT name, customer_name, email_id, mobile_no, customer_group, territory
      FROM \`tabCustomer\`
      WHERE LOWER(email_id) = :email
      LIMIT 1
    `,
    { email }
  );

  return rows[0]
    ? {
        name: rows[0].name,
        customerName: rows[0].customer_name,
        email: rows[0].email_id || email,
        phone: rows[0].mobile_no || "",
        group: rows[0].customer_group || "",
        territory: rows[0].territory || ""
      }
    : {
        name: "",
        customerName: email,
        email,
        phone: "",
        group: "",
        territory: ""
      };
}

export async function getCustomerOrdersByEmail(emailValue, limit = 20) {
  const email = normalizeEmail(emailValue);
  if (!email) return [];
  const maxLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);

  const [rows] = await getErpPool().execute(
    `
      SELECT
        so.name,
        so.customer,
        so.transaction_date,
        so.delivery_date,
        so.grand_total,
        so.status,
        so.per_delivered,
        so.per_billed,
        so.creation
      FROM \`tabSales Order\` so
      JOIN \`tabCustomer\` c ON c.name = so.customer
      WHERE LOWER(c.email_id) = :email
      ORDER BY so.creation DESC
      LIMIT :limit
    `,
    { email, limit: maxLimit }
  );

  return rows.map((row) => ({
    name: row.name,
    customer: row.customer,
    transactionDate: row.transaction_date,
    deliveryDate: row.delivery_date,
    grandTotal: Number(row.grand_total || 0),
    status: row.status,
    perDelivered: Number(row.per_delivered || 0),
    perBilled: Number(row.per_billed || 0),
    creation: row.creation
  }));
}

function documentLine(row) {
  return {
    itemCode: row.item_code,
    itemName: row.item_name || row.item_code,
    description: row.description || "",
    qty: Number(row.qty || 0),
    uom: row.uom || row.stock_uom || "",
    rate: Number(row.rate || 0),
    amount: Number(row.amount || 0),
    image: row.image || null,
    deliveryDate: row.delivery_date,
    deliveredQty: row.delivered_qty === undefined ? undefined : Number(row.delivered_qty || 0),
    billedAmount: row.billed_amt === undefined ? undefined : Number(row.billed_amt || 0)
  };
}

export async function getAccountQuotationDetailByEmail(emailValue, quotationName) {
  const email = normalizeEmail(emailValue);
  const name = clean(quotationName);
  if (!email || !name) return null;

  const [rows] = await getErpPool().execute(
    `
      SELECT
        q.name,
        q.owner,
        q.party_name,
        q.transaction_date,
        q.valid_till,
        q.grand_total,
        q.status,
        q.order_type,
        q.creation,
        q.enq_det,
        q.contact_email,
        q.contact_mobile,
        q.terms
      FROM \`tabQuotation\` q
      LEFT JOIN \`tabCustomer\` c ON c.name = q.party_name OR c.name = q.customer
      WHERE q.name = :name
        AND (
          LOWER(IFNULL(q.website_customer_email, '')) = :email
          OR LOWER(IFNULL(q.enq_det, '')) LIKE :emailMarker
          OR LOWER(IFNULL(c.email_id, '')) = :email
        )
      LIMIT 1
    `,
    { name, email, emailMarker: `%email: ${email}%` }
  );

  const row = rows[0];
  if (!row) return null;

  const [lineRows] = await getErpPool().execute(
    `
      SELECT item_code, item_name, description, qty, uom, stock_uom, rate, amount, image
      FROM \`tabQuotation Item\`
      WHERE parent = :name
      ORDER BY idx
    `,
    { name }
  );

  return {
    type: "quote",
    name: row.name,
    owner: row.owner,
    customer: row.party_name,
    transactionDate: row.transaction_date,
    validTill: row.valid_till,
    grandTotal: Number(row.grand_total || 0),
    status: row.status,
    orderType: row.order_type || "",
    creation: row.creation,
    marker: String(row.enq_det || "").split("\n")[0] || "",
    contactEmail: row.contact_email || email,
    contactMobile: row.contact_mobile || "",
    notes: row.enq_det || "",
    terms: row.terms || "",
    lines: lineRows.map(documentLine)
  };
}

export async function getAccountOrderDetailByEmail(emailValue, orderName) {
  const email = normalizeEmail(emailValue);
  const name = clean(orderName);
  if (!email || !name) return null;

  const [rows] = await getErpPool().execute(
    `
      SELECT
        so.name,
        so.customer,
        so.customer_name,
        so.transaction_date,
        so.delivery_date,
        so.grand_total,
        so.status,
        so.delivery_status,
        so.billing_status,
        so.per_delivered,
        so.per_billed,
        so.contact_email,
        so.contact_phone,
        so.po_no,
        so.po_date,
        so.terms,
        so.creation
      FROM \`tabSales Order\` so
      JOIN \`tabCustomer\` c ON c.name = so.customer
      WHERE so.name = :name
        AND LOWER(c.email_id) = :email
      LIMIT 1
    `,
    { name, email }
  );

  const row = rows[0];
  if (!row) return null;

  const [lineRows] = await getErpPool().execute(
    `
      SELECT item_code, item_name, description, qty, uom, stock_uom, rate, amount, image, delivery_date, delivered_qty, billed_amt
      FROM \`tabSales Order Item\`
      WHERE parent = :name
      ORDER BY idx
    `,
    { name }
  );

  return {
    type: "order",
    name: row.name,
    customer: row.customer_name || row.customer,
    transactionDate: row.transaction_date,
    deliveryDate: row.delivery_date,
    grandTotal: Number(row.grand_total || 0),
    status: row.status,
    deliveryStatus: row.delivery_status || "",
    billingStatus: row.billing_status || "",
    perDelivered: Number(row.per_delivered || 0),
    perBilled: Number(row.per_billed || 0),
    contactEmail: row.contact_email || email,
    contactPhone: row.contact_phone || "",
    poNo: row.po_no || "",
    poDate: row.po_date,
    terms: row.terms || "",
    creation: row.creation,
    lines: lineRows.map(documentLine)
  };
}

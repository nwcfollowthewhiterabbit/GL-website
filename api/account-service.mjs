import crypto from "node:crypto";
import { getErpPool } from "./erpnext-db.mjs";

const loginCodes = new Map();
const sessions = new Map();
const CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const WEBSITE_CUSTOMER_ROLE = "Website Customer";

function clean(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));
}

function nowMs() {
  return Date.now();
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function randomName(prefix) {
  return `${prefix}-${crypto.randomBytes(5).toString("hex")}`;
}

function stableName(prefix, value) {
  return `${prefix}-${crypto.createHash("sha1").update(value).digest("hex").slice(0, 16)}`;
}

function splitNameFromEmail(email) {
  const local = email.split("@")[0] || "Website";
  const parts = local.replace(/[._-]+/g, " ").split(" ").filter(Boolean);
  return {
    firstName: parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : "Website",
    lastName: parts.slice(1).join(" ")
  };
}

function purgeExpired() {
  const time = nowMs();
  for (const [email, entry] of loginCodes.entries()) {
    if (entry.expiresAt <= time) loginCodes.delete(email);
  }
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= time) sessions.delete(token);
  }
}

function placeholders(values, prefix = "value") {
  return values.map((_, index) => `:${prefix}${index}`).join(", ");
}

function namedList(values, prefix = "value") {
  return Object.fromEntries(values.map((value, index) => [`${prefix}${index}`, value]));
}

function accountLine(row) {
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

async function getUserByEmail(email) {
  const [rows] = await getErpPool().execute(
    `
      SELECT name, email, first_name, last_name, full_name, enabled, user_type, last_login, last_active
      FROM \`tabUser\`
      WHERE LOWER(name) = :email OR LOWER(email) = :email
      LIMIT 1
    `,
    { email }
  );
  if (!rows[0]) return null;

  const [roleRows] = await getErpPool().execute(
    "SELECT role FROM `tabHas Role` WHERE parent = :user AND parenttype = 'User' ORDER BY idx",
    { user: rows[0].name }
  );

  return {
    name: rows[0].name,
    email: rows[0].email || email,
    firstName: rows[0].first_name || "",
    lastName: rows[0].last_name || "",
    fullName: rows[0].full_name || rows[0].name,
    enabled: Boolean(Number(rows[0].enabled || 0)),
    userType: rows[0].user_type || "",
    lastLogin: rows[0].last_login || "",
    lastActive: rows[0].last_active || "",
    roles: roleRows.map((row) => row.role).filter(Boolean)
  };
}

async function getContactsByEmail(email) {
  const [rows] = await getErpPool().execute(
    `
      SELECT DISTINCT c.name, c.first_name, c.last_name, c.email_id, c.mobile_no, c.phone, c.user, c.status
      FROM \`tabContact\` c
      LEFT JOIN \`tabContact Email\` ce ON ce.parent = c.name
      WHERE LOWER(IFNULL(c.email_id, '')) = :email
         OR LOWER(IFNULL(ce.email_id, '')) = :email
         OR LOWER(IFNULL(c.user, '')) = :email
      ORDER BY c.is_primary_contact DESC, c.modified DESC
    `,
    { email }
  );
  return rows;
}

async function getCustomersForContacts(contacts) {
  if (!contacts.length) return [];
  const contactNames = contacts.map((contact) => contact.name);
  const params = namedList(contactNames, "contact");
  const [rows] = await getErpPool().execute(
    `
      SELECT DISTINCT c.name, c.customer_name, c.email_id, c.mobile_no, c.customer_group, c.territory
      FROM \`tabCustomer\` c
      JOIN \`tabDynamic Link\` dl ON dl.link_doctype = 'Customer' AND dl.link_name = c.name
      WHERE dl.parenttype = 'Contact'
        AND dl.parent IN (${placeholders(contactNames, "contact")})
      ORDER BY c.modified DESC
    `,
    params
  );
  return rows;
}

async function getFallbackCustomersByEmail(email) {
  const [rows] = await getErpPool().execute(
    `
      SELECT name, customer_name, email_id, mobile_no, customer_group, territory
      FROM \`tabCustomer\`
      WHERE LOWER(IFNULL(email_id, '')) = :email
      ORDER BY modified DESC
      LIMIT 5
    `,
    { email }
  );
  return rows;
}

function profileFromCustomer(row, email) {
  return row
    ? {
        name: row.name,
        customerName: row.customer_name || row.name,
        email: row.email_id || email,
        phone: row.mobile_no || "",
        group: row.customer_group || "",
        territory: row.territory || ""
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

export async function resolveCustomerAccessByEmail(emailValue) {
  const email = normalizeEmail(emailValue);
  if (!email) {
    return { email: "", user: null, contacts: [], customers: [], customerNames: [], profile: null, source: "empty" };
  }

  const [user, contacts] = await Promise.all([getUserByEmail(email), getContactsByEmail(email)]);
  let customers = await getCustomersForContacts(contacts);
  let source = customers.length ? "user_contact_customer" : "customer_email_fallback";
  if (!customers.length) customers = await getFallbackCustomersByEmail(email);

  const customerNames = customers.map((customer) => customer.name).filter(Boolean);
  return {
    email,
    user,
    contacts: contacts.map((contact) => ({
      name: contact.name,
      firstName: contact.first_name || "",
      lastName: contact.last_name || "",
      email: contact.email_id || email,
      phone: contact.mobile_no || contact.phone || "",
      user: contact.user || "",
      status: contact.status || ""
    })),
    customers: customers.map((customer) => profileFromCustomer(customer, email)),
    customerNames,
    profile: profileFromCustomer(customers[0], email),
    source
  };
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
    expiresAt: nowMs() + CODE_TTL_MS,
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
    expiresAt: nowMs() + SESSION_TTL_MS
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
  return sessions.get(token) || null;
}

export function endAccountSession(tokenValue) {
  const token = clean(tokenValue);
  if (token) sessions.delete(token);
}

export async function getCustomerProfileByEmail(emailValue) {
  return (await resolveCustomerAccessByEmail(emailValue)).profile;
}

export async function getCustomerQuotesForAccount(emailValue, limit = 20) {
  const access = await resolveCustomerAccessByEmail(emailValue);
  const maxLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const params = { email: access.email, limit: maxLimit };
  const customerClause = access.customerNames.length
    ? `OR q.party_name IN (${placeholders(access.customerNames, "customer")}) OR q.customer IN (${placeholders(access.customerNames, "customer")})`
    : "";
  Object.assign(params, namedList(access.customerNames, "customer"));

  const [rows] = await getErpPool().execute(
    `
      SELECT q.name, q.owner, q.party_name, q.transaction_date, q.valid_till, q.grand_total, q.status, q.order_type, q.creation, q.enq_det
      FROM \`tabQuotation\` q
      WHERE LOWER(IFNULL(q.website_customer_email, '')) = :email
         ${customerClause}
      ORDER BY q.creation DESC
      LIMIT :limit
    `,
    params
  );

  return rows.map((row) => ({
    name: row.name,
    owner: row.owner,
    customer: row.party_name,
    transactionDate: row.transaction_date,
    validTill: row.valid_till,
    grandTotal: Number(row.grand_total || 0),
    status: row.status,
    orderType: row.order_type || "",
    creation: row.creation,
    marker: String(row.enq_det || "").split("\n")[0] || ""
  }));
}

export async function getCustomerOrdersByEmail(emailValue, limit = 20) {
  const access = await resolveCustomerAccessByEmail(emailValue);
  if (!access.email) return [];
  const maxLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const params = { email: access.email, limit: maxLimit };
  const customerClause = access.customerNames.length ? `OR so.customer IN (${placeholders(access.customerNames, "customer")})` : "";
  Object.assign(params, namedList(access.customerNames, "customer"));

  const [rows] = await getErpPool().execute(
    `
      SELECT so.name, so.customer, so.customer_name, so.transaction_date, so.delivery_date, so.grand_total, so.status,
             so.per_delivered, so.per_billed, so.creation
      FROM \`tabSales Order\` so
      JOIN \`tabCustomer\` c ON c.name = so.customer
      WHERE LOWER(IFNULL(c.email_id, '')) = :email
         ${customerClause}
      ORDER BY so.creation DESC
      LIMIT :limit
    `,
    params
  );

  return rows.map((row) => ({
    name: row.name,
    customer: row.customer_name || row.customer,
    transactionDate: row.transaction_date,
    deliveryDate: row.delivery_date,
    grandTotal: Number(row.grand_total || 0),
    status: row.status,
    perDelivered: Number(row.per_delivered || 0),
    perBilled: Number(row.per_billed || 0),
    creation: row.creation
  }));
}

export async function getCustomerInvoicesByEmail(emailValue, limit = 20) {
  const access = await resolveCustomerAccessByEmail(emailValue);
  if (!access.email) return [];
  const maxLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const params = { email: access.email, limit: maxLimit };
  const customerClause = access.customerNames.length ? `OR si.customer IN (${placeholders(access.customerNames, "customer")})` : "";
  Object.assign(params, namedList(access.customerNames, "customer"));

  const [rows] = await getErpPool().execute(
    `
      SELECT si.name, si.customer, si.customer_name, si.posting_date, si.due_date, si.grand_total, si.outstanding_amount,
             si.status, si.creation
      FROM \`tabSales Invoice\` si
      JOIN \`tabCustomer\` c ON c.name = si.customer
      WHERE LOWER(IFNULL(c.email_id, '')) = :email
         ${customerClause}
      ORDER BY si.creation DESC
      LIMIT :limit
    `,
    params
  );

  return rows.map((row) => ({
    name: row.name,
    customer: row.customer_name || row.customer,
    postingDate: row.posting_date,
    dueDate: row.due_date,
    grandTotal: Number(row.grand_total || 0),
    outstandingAmount: Number(row.outstanding_amount || 0),
    status: row.status,
    creation: row.creation
  }));
}

export async function getAccountQuotationDetailByEmail(emailValue, quotationName) {
  const access = await resolveCustomerAccessByEmail(emailValue);
  const name = clean(quotationName);
  if (!access.email || !name) return null;
  const params = { name, email: access.email };
  const customerClause = access.customerNames.length
    ? `OR q.party_name IN (${placeholders(access.customerNames, "customer")}) OR q.customer IN (${placeholders(access.customerNames, "customer")})`
    : "";
  Object.assign(params, namedList(access.customerNames, "customer"));

  const [rows] = await getErpPool().execute(
    `
      SELECT q.name, q.owner, q.party_name, q.transaction_date, q.valid_till, q.grand_total, q.status, q.order_type,
             q.creation, q.enq_det, q.contact_email, q.contact_mobile, q.terms
      FROM \`tabQuotation\` q
      WHERE q.name = :name
        AND (
          LOWER(IFNULL(q.website_customer_email, '')) = :email
          ${customerClause}
        )
      LIMIT 1
    `,
    params
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
    contactEmail: row.contact_email || access.email,
    contactMobile: row.contact_mobile || "",
    notes: row.enq_det || "",
    terms: row.terms || "",
    lines: lineRows.map(accountLine)
  };
}

export async function getAccountOrderDetailByEmail(emailValue, orderName) {
  const access = await resolveCustomerAccessByEmail(emailValue);
  const name = clean(orderName);
  if (!access.email || !name) return null;
  const params = { name, email: access.email };
  const customerClause = access.customerNames.length ? `OR so.customer IN (${placeholders(access.customerNames, "customer")})` : "";
  Object.assign(params, namedList(access.customerNames, "customer"));

  const [rows] = await getErpPool().execute(
    `
      SELECT so.name, so.customer, so.customer_name, so.transaction_date, so.delivery_date, so.grand_total, so.status,
             so.delivery_status, so.billing_status, so.per_delivered, so.per_billed, so.contact_email, so.contact_phone,
             so.po_no, so.po_date, so.terms, so.creation
      FROM \`tabSales Order\` so
      JOIN \`tabCustomer\` c ON c.name = so.customer
      WHERE so.name = :name
        AND (LOWER(IFNULL(c.email_id, '')) = :email ${customerClause})
      LIMIT 1
    `,
    params
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
    contactEmail: row.contact_email || access.email,
    contactPhone: row.contact_phone || "",
    poNo: row.po_no || "",
    poDate: row.po_date,
    terms: row.terms || "",
    creation: row.creation,
    lines: lineRows.map(accountLine)
  };
}

export async function getAccountInvoiceDetailByEmail(emailValue, invoiceName) {
  const access = await resolveCustomerAccessByEmail(emailValue);
  const name = clean(invoiceName);
  if (!access.email || !name) return null;
  const params = { name, email: access.email };
  const customerClause = access.customerNames.length ? `OR si.customer IN (${placeholders(access.customerNames, "customer")})` : "";
  Object.assign(params, namedList(access.customerNames, "customer"));

  const [rows] = await getErpPool().execute(
    `
      SELECT si.name, si.customer, si.customer_name, si.posting_date, si.due_date, si.grand_total, si.outstanding_amount,
             si.status, si.contact_email, si.contact_mobile, si.po_no, si.po_date, si.terms, si.creation
      FROM \`tabSales Invoice\` si
      JOIN \`tabCustomer\` c ON c.name = si.customer
      WHERE si.name = :name
        AND (LOWER(IFNULL(c.email_id, '')) = :email ${customerClause})
      LIMIT 1
    `,
    params
  );
  const row = rows[0];
  if (!row) return null;

  const [lineRows] = await getErpPool().execute(
    `
      SELECT item_code, item_name, description, qty, uom, stock_uom, rate, amount
      FROM \`tabSales Invoice Item\`
      WHERE parent = :name
      ORDER BY idx
    `,
    { name }
  );

  return {
    type: "invoice",
    name: row.name,
    customer: row.customer_name || row.customer,
    postingDate: row.posting_date,
    dueDate: row.due_date,
    grandTotal: Number(row.grand_total || 0),
    outstandingAmount: Number(row.outstanding_amount || 0),
    status: row.status,
    contactEmail: row.contact_email || access.email,
    contactMobile: row.contact_mobile || "",
    poNo: row.po_no || "",
    poDate: row.po_date,
    terms: row.terms || "",
    creation: row.creation,
    lines: lineRows.map(accountLine)
  };
}

async function ensureWebsiteCustomerRole() {
  const now = nowSql();
  await getErpPool().execute(
    `
      INSERT INTO \`tabRole\`
        (name, creation, modified, modified_by, owner, docstatus, idx, role_name, desk_access, disabled, is_custom)
      VALUES
        (:role, :now, :now, 'Administrator', 'Administrator', 0, 0, :role, 0, 0, 1)
      ON DUPLICATE KEY UPDATE
        modified = VALUES(modified),
        role_name = VALUES(role_name),
        desk_access = 0,
        disabled = 0
    `,
    { role: WEBSITE_CUSTOMER_ROLE, now }
  );
}

async function ensureUser(email, firstName = "", lastName = "") {
  const now = nowSql();
  const fallbackName = splitNameFromEmail(email);
  const first = clean(firstName) || fallbackName.firstName;
  const last = clean(lastName) || fallbackName.lastName;
  const fullName = [first, last].filter(Boolean).join(" ") || email;

  await getErpPool().execute(
    `
      INSERT INTO \`tabUser\`
        (name, creation, modified, modified_by, owner, docstatus, idx, enabled, email, first_name, last_name, full_name,
         user_type, send_welcome_email, thread_notify, simultaneous_sessions, logout_all_sessions)
      VALUES
        (:email, :now, :now, 'Administrator', 'Administrator', 0, 0, 1, :email, :first, :last, :fullName,
         'Website User', 1, 1, 2, 1)
      ON DUPLICATE KEY UPDATE
        modified = VALUES(modified),
        enabled = 1,
        email = VALUES(email),
        first_name = IFNULL(NULLIF(first_name, ''), VALUES(first_name)),
        last_name = IFNULL(NULLIF(last_name, ''), VALUES(last_name)),
        full_name = IFNULL(NULLIF(full_name, ''), VALUES(full_name)),
        user_type = 'Website User'
    `,
    { email, now, first, last, fullName }
  );

  await ensureWebsiteCustomerRole();
  await getErpPool().execute(
    `
      INSERT INTO \`tabHas Role\`
        (name, creation, modified, modified_by, owner, docstatus, idx, parent, parentfield, parenttype, role)
      VALUES
        (:name, :now, :now, 'Administrator', 'Administrator', 0, 1, :email, 'roles', 'User', :role)
      ON DUPLICATE KEY UPDATE modified = VALUES(modified), role = VALUES(role)
    `,
    { name: stableName("user-role", `${email}-${WEBSITE_CUSTOMER_ROLE}`), now, email, role: WEBSITE_CUSTOMER_ROLE }
  );
}

async function ensureContact(customerName, email, firstName = "", lastName = "") {
  const now = nowSql();
  const fallbackName = splitNameFromEmail(email);
  const first = clean(firstName) || fallbackName.firstName;
  const last = clean(lastName) || fallbackName.lastName;

  const [existing] = await getErpPool().execute(
    `
      SELECT DISTINCT c.name
      FROM \`tabContact\` c
      LEFT JOIN \`tabContact Email\` ce ON ce.parent = c.name
      WHERE LOWER(IFNULL(c.email_id, '')) = :email
         OR LOWER(IFNULL(ce.email_id, '')) = :email
         OR LOWER(IFNULL(c.user, '')) = :email
      ORDER BY c.modified DESC
      LIMIT 1
    `,
    { email }
  );
  const contactName = existing[0]?.name || randomName("website-contact");

  if (!existing[0]) {
    await getErpPool().execute(
      `
        INSERT INTO \`tabContact\`
          (name, creation, modified, modified_by, owner, docstatus, idx, first_name, last_name, email_id, user, status,
           is_primary_contact)
        VALUES
          (:name, :now, :now, 'Administrator', 'Administrator', 0, 0, :first, :last, :email, :email, 'Passive', 1)
      `,
      { name: contactName, now, first, last, email }
    );
  } else {
    await getErpPool().execute(
      `
        UPDATE \`tabContact\`
        SET modified = :now,
            email_id = IFNULL(NULLIF(email_id, ''), :email),
            user = IFNULL(NULLIF(user, ''), :email)
        WHERE name = :name
      `,
      { now, email, name: contactName }
    );
  }

  await getErpPool().execute(
    `
      INSERT INTO \`tabContact Email\`
        (name, creation, modified, modified_by, owner, docstatus, idx, parent, parentfield, parenttype, email_id, is_primary)
      VALUES
        (:name, :now, :now, 'Administrator', 'Administrator', 0, 1, :contact, 'email_ids', 'Contact', :email, 1)
      ON DUPLICATE KEY UPDATE modified = VALUES(modified), email_id = VALUES(email_id), is_primary = 1
    `,
    { name: stableName("contact-email", `${contactName}-${email}`), now, contact: contactName, email }
  );

  await getErpPool().execute(
    `
      INSERT INTO \`tabDynamic Link\`
        (name, creation, modified, modified_by, owner, docstatus, idx, parent, parentfield, parenttype,
         link_doctype, link_name, link_title)
      VALUES
        (:name, :now, :now, 'Administrator', 'Administrator', 0, 1, :contact, 'links', 'Contact',
         'Customer', :customer, :customer)
      ON DUPLICATE KEY UPDATE modified = VALUES(modified), link_name = VALUES(link_name), link_title = VALUES(link_title)
    `,
    { name: stableName("contact-link", `${contactName}-Customer-${customerName}`), now, contact: contactName, customer: customerName }
  );

  return contactName;
}

export async function linkWebsiteCustomerAccess({ customer, email, firstName = "", lastName = "" }) {
  const customerName = clean(customer);
  const normalizedEmail = normalizeEmail(email);
  if (!customerName) return { ok: false, error: "customer_required" };
  if (!isValidEmail(normalizedEmail)) return { ok: false, error: "invalid_email" };

  const [customers] = await getErpPool().execute(
    "SELECT name, customer_name FROM `tabCustomer` WHERE name = :customer LIMIT 1",
    { customer: customerName }
  );
  if (!customers[0]) return { ok: false, error: "customer_not_found" };

  await ensureUser(normalizedEmail, firstName, lastName);
  const contact = await ensureContact(customerName, normalizedEmail, firstName, lastName);
  return {
    ok: true,
    customer: customers[0].name,
    customerName: customers[0].customer_name || customers[0].name,
    email: normalizedEmail,
    contact,
    user: normalizedEmail,
    role: WEBSITE_CUSTOMER_ROLE
  };
}

export async function disableWebsiteCustomerAccess(emailValue) {
  const email = normalizeEmail(emailValue);
  if (!isValidEmail(email)) return { ok: false, error: "invalid_email" };
  await getErpPool().execute(
    "UPDATE `tabUser` SET enabled = 0, modified = :now WHERE LOWER(name) = :email OR LOWER(email) = :email",
    { email, now: nowSql() }
  );
  return { ok: true, email };
}

export async function getWebsiteCustomerAccessList({ q = "", limit = 30 } = {}) {
  const search = `%${clean(q).toLowerCase()}%`;
  const maxLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const [rows] = await getErpPool().execute(
    `
      SELECT
        c.name,
        c.customer_name,
        c.email_id,
        c.customer_group,
        c.territory,
        (SELECT COUNT(*) FROM \`tabSales Order\` so WHERE so.customer = c.name) AS sales_orders,
        (SELECT COUNT(*) FROM \`tabSales Invoice\` si WHERE si.customer = c.name) AS invoices
      FROM \`tabCustomer\` c
      WHERE (:search = '%%'
         OR LOWER(c.name) LIKE :search
         OR LOWER(IFNULL(c.customer_name, '')) LIKE :search
         OR LOWER(IFNULL(c.email_id, '')) LIKE :search)
      ORDER BY c.modified DESC
      LIMIT :limit
    `,
    { search, limit: maxLimit }
  );

  const customers = [];
  for (const row of rows) {
    const [accessRows] = await getErpPool().execute(
      `
        SELECT DISTINCT
          ct.name AS contact,
          COALESCE(NULLIF(ce.email_id, ''), NULLIF(ct.email_id, ''), NULLIF(c.email_id, '')) AS email,
          u.name AS user,
          u.enabled,
          u.last_login
        FROM \`tabCustomer\` c
        LEFT JOIN \`tabDynamic Link\` dl ON dl.link_doctype = 'Customer' AND dl.link_name = c.name AND dl.parenttype = 'Contact'
        LEFT JOIN \`tabContact\` ct ON ct.name = dl.parent
        LEFT JOIN \`tabContact Email\` ce ON ce.parent = ct.name
        LEFT JOIN \`tabUser\` u ON LOWER(u.name) = LOWER(COALESCE(NULLIF(ct.user, ''), NULLIF(ce.email_id, ''), NULLIF(ct.email_id, ''), NULLIF(c.email_id, '')))
                             OR LOWER(u.email) = LOWER(COALESCE(NULLIF(ce.email_id, ''), NULLIF(ct.email_id, ''), NULLIF(c.email_id, '')))
        WHERE c.name = :customer
        LIMIT 20
      `,
      { customer: row.name }
    );
    const contacts = [...new Set(accessRows.map((access) => clean(access.contact)).filter(Boolean))];
    const emails = [...new Set([row.email_id, ...accessRows.map((access) => clean(access.email))].filter(Boolean))];
    const users = [...new Set(accessRows.map((access) => clean(access.user)).filter(Boolean))];
    const websiteAccessEnabled = accessRows.some((access) => Number(access.enabled || 0));
    const lastLogin = accessRows.map((access) => access.last_login).filter(Boolean).sort().pop() || "";

    customers.push({
      customer: row.name,
      customerName: row.customer_name || row.name,
      email: row.email_id || "",
      group: row.customer_group || "",
      territory: row.territory || "",
      contacts,
      emails,
      users,
      websiteAccessEnabled,
      lastLogin,
      salesOrders: Number(row.sales_orders || 0),
      invoices: Number(row.invoices || 0)
    });
  }

  return customers.sort((a, b) => Number(b.websiteAccessEnabled) - Number(a.websiteAccessEnabled));
}

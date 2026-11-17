import crypto from "node:crypto";
import mysql from "mysql2/promise";
import { getErpPool, getErpDbConfig } from "./erpnext-db.mjs";
import { createDoc, hasErpnextRestCredentials, listDoc } from "./erpnext-rest.mjs";
import { EXCLUDED_STOREFRONT_GROUPS } from "./catalog-service.mjs";
import { getCatalogPublicationSql } from "./catalog-publication-rules.mjs";
import { legacySyncRules } from "./legacy-sync-rules.mjs";
import { availableCustomFields } from "./storefront-rules.mjs";

const DEFAULTS = legacySyncRules.quote.defaults;
const customFieldCache = new Map();
const inFlightQuoteRequests = new Map();
const EXCLUDED_STOCK_WAREHOUSES = ["Showroom - GL", "Furniture Showroom (Upstairs) - GL"];
const MAX_QUOTE_LINES = 50;
const MAX_QUOTE_QUANTITY = 1000;
const MAX_CUSTOMER_FIELD_LENGTH = 200;
const MAX_NOTES_LENGTH = 2000;

function clean(value) {
  return String(value || "").trim();
}

export function quoteTransactionDate(now = new Date(), timeZone = process.env.ERP_TIME_ZONE || "Pacific/Fiji") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function quoteId() {
  return `GLQ-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeQuoteRequestId(value) {
  const normalized = clean(value).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
  return normalized || quoteId();
}

export function quoteMarkerFromId(value) {
  return `Green Leaf Website Quote #${normalizeQuoteRequestId(value)}`;
}

async function hasCustomField(dt, fieldname) {
  const key = `${dt}.${fieldname}`;
  if (customFieldCache.has(key)) return customFieldCache.get(key);

  const [rows] = await getErpPool().execute(
    "SELECT name FROM `tabCustom Field` WHERE dt = :dt AND fieldname = :fieldname LIMIT 1",
    { dt, fieldname }
  );
  const exists = Boolean(rows[0]);
  customFieldCache.set(key, exists);
  return exists;
}

async function hasCustomFields(dt, fieldnames) {
  const entries = await Promise.all(fieldnames.map(async (fieldname) => [fieldname, await hasCustomField(dt, fieldname)]));
  return Object.fromEntries(entries);
}

function normalizeLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .slice(0, MAX_QUOTE_LINES)
    .filter((line) => line && typeof line === "object")
    .map((line) => ({
      sku: clean(line.sku || line.item_code || line.itemCode),
      qty: Number(line.qty ?? line.quantity ?? 1),
      note: clean(line.note).slice(0, 500)
    }))
    .filter(
      (line) =>
        line.sku &&
        line.sku.length <= 140 &&
        Number.isFinite(line.qty) &&
        line.qty > 0 &&
        line.qty <= MAX_QUOTE_QUANTITY
    );
}

export function validQuoteLines(lines) {
  if (!Array.isArray(lines) || !lines.length || lines.length > MAX_QUOTE_LINES) return false;
  if (lines.some((line) => !line || typeof line !== "object")) return false;
  const normalized = normalizeLines(lines);
  return normalized.length === lines.length && new Set(normalized.map((line) => line.sku)).size === normalized.length;
}

export function bindQuoteToAccount(payload, account) {
  if (!account?.email || !account?.customer) return { error: "not_authenticated" };
  const email = clean(account.email).toLowerCase();
  const suppliedEmail = clean(payload?.customer?.email).toLowerCase();
  if (suppliedEmail && suppliedEmail !== email) return { error: "account_email_mismatch" };
  return { payload: { ...payload, customer: { ...payload?.customer, email } } };
}

export function trustedQuoteRate(item) {
  const rate = Number(item?.price);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

async function getErpItemsBySku(skus, priceList = DEFAULTS.priceList) {
  if (!skus.length) return new Map();

  const placeholders = skus.map((_, index) => `:sku${index}`).join(", ");
  const params = Object.fromEntries(skus.map((sku, index) => [`sku${index}`, sku]));
  const excludedGroups = EXCLUDED_STOREFRONT_GROUPS.map((_, index) => `:excludedGroup${index}`).join(", ");
  EXCLUDED_STOREFRONT_GROUPS.forEach((group, index) => {
    params[`excludedGroup${index}`] = group;
  });
  params.priceList = priceList;
  params.excludedWarehouse0 = EXCLUDED_STOCK_WAREHOUSES[0];
  params.excludedWarehouse1 = EXCLUDED_STOCK_WAREHOUSES[1];
  const [itemFields, groupFields, publication] = await Promise.all([
    availableCustomFields("Item", ["website_show_on_storefront"]),
    availableCustomFields("Item Group", ["website_show_on_storefront"]),
    getCatalogPublicationSql()
  ]);
  const publicationClauses = [
    "IFNULL(i.disabled, 0) = 0",
    "IFNULL(i.is_sales_item, 1) = 1",
    "IFNULL(i.has_variants, 0) = 0",
    `IFNULL(i.item_group, '') NOT IN (${excludedGroups})`,
    publication.productReady
  ];
  if (itemFields.website_show_on_storefront) {
    publicationClauses.push("IFNULL(i.website_show_on_storefront, 1) = 1");
  }
  if (groupFields.website_show_on_storefront) {
    publicationClauses.push("IFNULL(ig.website_show_on_storefront, 1) = 1");
  }

  const [rows] = await getErpPool().execute(
    `
      SELECT
        i.name AS sku,
        i.item_name AS item_name,
        i.stock_uom,
        IFNULL(price.price_list_rate, 0) AS price,
        IFNULL(price.currency, :currency) AS currency,
        GREATEST(FLOOR(IFNULL(stock.actual_qty, 0)), 0) AS available_quantity
      FROM \`tabItem\` i
      LEFT JOIN (
        SELECT ip.item_code, ip.price_list_rate, ip.currency
        FROM \`tabItem Price\` ip
        JOIN (
          SELECT item_code, MAX(modified) AS modified
          FROM \`tabItem Price\`
          WHERE price_list = :priceList
            AND docstatus = 0
            AND (valid_upto IS NULL OR valid_upto >= CURDATE())
          GROUP BY item_code
        ) latest ON latest.item_code = ip.item_code AND latest.modified = ip.modified
        WHERE ip.price_list = :priceList AND ip.docstatus = 0
      ) price ON price.item_code = i.name
      LEFT JOIN (
        SELECT b.item_code, SUM(b.actual_qty) AS actual_qty
        FROM \`tabBin\` b
        JOIN \`tabWarehouse\` w ON w.name = b.warehouse
        WHERE IFNULL(w.disabled, 0) = 0
          AND w.name NOT IN (:excludedWarehouse0, :excludedWarehouse1)
          AND LOWER(w.name) NOT LIKE '%showroom%'
        GROUP BY b.item_code
      ) stock ON stock.item_code = i.name
      LEFT JOIN \`tabItem Group\` ig ON ig.name = i.item_group
      WHERE i.name IN (${placeholders})
        AND ${publicationClauses.join("\n        AND ")}
    `,
    { ...params, currency: process.env.DEFAULT_CURRENCY || "FJD" }
  );

  return new Map(rows.map((row) => [row.sku, row]));
}

async function findCustomerByEmail(email) {
  if (!email) return null;
  const [rows] = await getErpPool().execute(
    "SELECT name, customer_name FROM `tabCustomer` WHERE BINARY LOWER(email_id) = BINARY :email LIMIT 1",
    { email }
  );
  return rows[0] || null;
}

function buildCustomerName(customer) {
  return clean(customer.company) || clean(customer.contact) || clean(customer.email) || "Website Customer";
}

async function getOrCreateCustomer(customer) {
  const email = clean(customer.email);
  const existing = await findCustomerByEmail(email);
  if (existing) return { name: existing.name, created: false };

  if (!hasErpnextRestCredentials()) {
    return {
      name: `WEB-${(email || buildCustomerName(customer)).toLowerCase().replace(/\s+/g, "-").slice(0, 120)}`,
      created: false,
      pendingCreate: true
    };
  }

  const customerFields = await hasCustomFields("Customer", ["website_origin", "website_last_quote_request"]);
  const customerDoc = {
    customer_name: buildCustomerName(customer).slice(0, 140),
    customer_group: process.env.ERP_CUSTOMER_GROUP || DEFAULTS.customerGroup,
    territory: process.env.ERP_TERRITORY || DEFAULTS.territory,
    customer_type: "Company",
    email_id: email || undefined,
    mobile_no: clean(customer.phone) || undefined
  };

  if (customerFields.website_origin) customerDoc.website_origin = "greenleaf-storefront";
  if (customerFields.website_last_quote_request) customerDoc.website_last_quote_request = new Date().toISOString().slice(0, 19).replace("T", " ");

  const created = await createDoc("Customer", customerDoc);

  return { name: created.name, created: true };
}

export function quoteRequestFingerprint(payload = {}) {
  const customer = payload.customer || payload;
  const binding = {
    id: normalizeQuoteRequestId(payload.id),
    customer: {
      company: clean(customer.company), contact: clean(customer.contact),
      email: clean(customer.email).toLowerCase(), phone: clean(customer.phone),
      location: clean(customer.location || payload.deliveryLocation)
    },
    lines: normalizeLines(payload.lines),
    notes: clean(payload.notes)
  };
  return crypto.createHash("sha256").update(JSON.stringify(binding)).digest("hex");
}

export function quoteLookupSql(fields) {
  const columns = ["name", "enq_det",
    fields.website_quote_id ? "website_quote_id" : "NULL AS website_quote_id",
    fields.website_customer_email ? "website_customer_email" : "NULL AS website_customer_email",
    fields.website_payload ? "website_payload" : "NULL AS website_payload"];
  // Exact first-line legacy marker, never LIKE: underscores and prefixes are literal.
  const legacy = "SUBSTRING_INDEX(enq_det, CHAR(10), 1) = :marker";
  const where = fields.website_quote_id
    ? `website_quote_id = :id OR ((website_quote_id IS NULL OR website_quote_id = '') AND ${legacy})`
    : legacy;
  return `SELECT ${columns.join(", ")} FROM \`tabQuotation\` WHERE ${where} ORDER BY creation DESC LIMIT 2`;
}

export function quoteReplayMatches(row, payload) {
  try {
    const stored = JSON.parse(row.website_payload || "null");
    if (!stored || stored.id !== payload.id || !stored.customer?.email) return false;
    const email = clean(payload.customer?.email || payload.email).toLowerCase();
    if (clean(stored.customer.email).toLowerCase() !== email) return false;
    if (row.website_customer_email && clean(row.website_customer_email).toLowerCase() !== email) return false;
    return quoteRequestFingerprint(stored) === quoteRequestFingerprint(payload);
  } catch {
    return false;
  }
}

async function existingQuotationByMarker(marker, id, payload) {
  const fields = await hasCustomFields("Quotation", ["website_quote_id", "website_customer_email", "website_payload"]);
  const [rows] = await getErpPool().execute(quoteLookupSql(fields), { id, marker });
  if (!rows.length) return null;
  if (rows.length !== 1 || !quoteReplayMatches(rows[0], payload)) return { conflict: true };
  return { name: rows[0].name };
}

export async function withQuoteRequestLock(id, operation, openConnection = null) {
  // A separate short-lived connection avoids consuming the bounded read pool
  // while the request's ERP SQL/REST work is in progress.
  const connect = openConnection || (() => {
    const { connectionLimit, waitForConnections, ...config } = getErpDbConfig();
    return mysql.createConnection(config);
  });
  const connection = await connect();
  const lockName = "glquote:" + crypto.createHash("sha256").update(id.toLowerCase()).digest("hex").slice(0, 54);
  let acquired = false;
  try {
    const [rows] = await connection.execute("SELECT GET_LOCK(?, 30) AS acquired", [lockName]);
    acquired = Number(rows[0]?.acquired) === 1;
    if (!acquired) throw new Error("quote_request_busy");
    return await operation();
  } finally {
    if (acquired) await connection.execute("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => undefined);
    await connection.end();
  }
}

export function coalesceQuoteRequest(payload, operation) {
  const fingerprint = quoteRequestFingerprint(payload);
  const requestKey = payload.id.toLowerCase();
  const existing = inFlightQuoteRequests.get(requestKey);
  if (existing) {
    return existing.fingerprint === fingerprint ? existing.promise : Promise.resolve({
      mode: "validation_failed", error: "request_id_conflict", id: payload.id
    });
  }
  const promise = Promise.resolve().then(operation).finally(() => inFlightQuoteRequests.delete(requestKey));
  inFlightQuoteRequests.set(requestKey, { fingerprint, promise });
  return promise;
}

export async function prepareQuoteRequest(payload = {}, account = null) {
  const id = normalizeQuoteRequestId(payload.id);
  const marker = quoteMarkerFromId(id);
  const customer = payload.customer || {
    company: payload.company,
    contact: payload.contact,
    email: payload.email,
    phone: payload.phone
  };
  const normalizedCustomer = {
    company: clean(customer.company),
    contact: clean(customer.contact),
    email: clean(customer.email).toLowerCase(),
    phone: clean(customer.phone),
    location: clean(customer.location || payload.deliveryLocation)
  };
  const lines = normalizeLines(payload.lines);
  const skus = [...new Set(lines.map((line) => line.sku))];
  const erpItems = await getErpItemsBySku(skus, process.env.DEFAULT_PRICE_LIST || DEFAULTS.priceList);

  const missing = [];
  const validLines = [];

  for (const line of lines) {
    const item = erpItems.get(line.sku);
    if (!item) {
      missing.push({ sku: line.sku, reason: "item_not_found" });
      continue;
    }

    validLines.push({
      item_code: line.sku,
      item_name: item.item_name || line.sku,
      qty: line.qty,
      rate: trustedQuoteRate(item),
      uom: item.stock_uom || "Nos",
      availableQuantity: Number(item.available_quantity || 0),
      fulfillmentStatus:
        Number(item.available_quantity || 0) <= 0
          ? "special_order"
          : Number(item.available_quantity || 0) < line.qty
            ? "low_stock"
            : "in_stock"
    });
  }

  const fulfillment = {
    mode: validLines.some((line) => line.fulfillmentStatus === "special_order")
      ? "special_order"
      : validLines.some((line) => line.fulfillmentStatus === "low_stock")
        ? "low_stock"
        : "in_stock",
    requiresSalesConfirmation: true,
    onlinePaymentEnabled: false
  };

  const duplicate = await existingQuotationByMarker(marker, id, { ...payload, id });
  const duplicateQuotation = duplicate?.name || null;
  const requestConflict = Boolean(duplicate?.conflict);
  // Invalid or repeated requests must not create a new Customer as a side effect.
  const erpCustomer = validLines.length && !missing.length && !duplicateQuotation && !requestConflict
    ? account?.customer ? { name: account.customer, created: false } : await getOrCreateCustomer(normalizedCustomer)
    : { name: "", created: false };

  const notes = [
    marker,
    normalizedCustomer.company ? `Company: ${normalizedCustomer.company}` : "",
    normalizedCustomer.contact ? `Contact: ${normalizedCustomer.contact}` : "",
    normalizedCustomer.email ? `Email: ${normalizedCustomer.email}` : "",
    normalizedCustomer.phone ? `Phone: ${normalizedCustomer.phone}` : "",
    normalizedCustomer.location ? `Delivery location: ${normalizedCustomer.location}` : "",
    `Website quotation request: ${fulfillment.mode}`,
    "Sales review required. No online payment or confirmed Sales Order is created by this request.",
    "Catalog prices exclude VAT; confirm availability, VAT, delivery and final quotation with the customer.",
    clean(payload.notes) ? `Notes: ${clean(payload.notes)}` : "",
    missing.length ? `Missing SKU lines: ${missing.map((line) => line.sku).join(", ")}` : ""
  ].filter(Boolean);

  const quotationDoc = {
    doctype: "Quotation",
    quotation_to: "Customer",
    party_name: erpCustomer.name,
    company: process.env.ERP_COMPANY || DEFAULTS.company,
    transaction_date: quoteTransactionDate(),
    currency: process.env.DEFAULT_CURRENCY || "FJD",
    selling_price_list: process.env.DEFAULT_PRICE_LIST || DEFAULTS.priceList,
    order_type: "Sales",
    items: validLines.map((line) => ({
      item_code: line.item_code,
      qty: line.qty,
      rate: line.rate
    })),
    enq_det: notes.join("\n")
  };

  const quotationFields = await hasCustomFields("Quotation", [
    "website_quote_id",
    "website_source",
    "website_customer_email",
    "website_payload"
  ]);

  if (quotationFields.website_quote_id) quotationDoc.website_quote_id = id;
  if (quotationFields.website_source) quotationDoc.website_source = "greenleaf-storefront";
  if (quotationFields.website_customer_email) quotationDoc.website_customer_email = normalizedCustomer.email || undefined;
  if (quotationFields.website_payload) {
    quotationDoc.website_payload = JSON.stringify({
      id,
      marker,
      customer: normalizedCustomer,
      lines,
      fulfillment,
      missing,
      notes: clean(payload.notes)
    });
  }

  return {
    id,
    marker,
    customer: normalizedCustomer,
    erpCustomer,
    validLines,
    fulfillment,
    missing,
    duplicateQuotation,
    requestConflict,
    quotationDoc,
    canCreate: hasErpnextRestCredentials() && validLines.length > 0 && !missing.length && !duplicateQuotation && !requestConflict
  };
}

async function createQuoteRequestOnce(payload = {}, account = null) {
  const customer = payload.customer || {};
  const requiredCustomerFields = ["company", "contact", "email", "phone", "location"].filter((field) => !clean(customer[field]));
  if (requiredCustomerFields.length) {
    return {
      mode: "validation_failed",
      error: "customer_details_required",
      missingCustomerFields: requiredCustomerFields
    };
  }
  const invalidCustomerFields = ["company", "contact", "email", "phone", "location"].filter(
    (field) => clean(customer[field]).length > MAX_CUSTOMER_FIELD_LENGTH
  );
  if (
    invalidCustomerFields.length ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(customer.email)) ||
    !validQuoteLines(payload.lines) ||
    clean(payload.notes).length > MAX_NOTES_LENGTH
  ) {
    return { mode: "validation_failed", error: "invalid_quote_payload" };
  }

  const prepared = await prepareQuoteRequest(payload, account);

  if (prepared.requestConflict) {
    return { mode: "validation_failed", error: "request_id_conflict", id: prepared.id };
  }

  if (prepared.duplicateQuotation) {
    return {
      mode: "idempotent",
      id: prepared.id,
      quotation: prepared.duplicateQuotation,
      missing: prepared.missing,
      validLines: prepared.validLines,
      fulfillment: prepared.fulfillment
    };
  }

  if (!prepared.validLines.length || prepared.missing.length) {
    return {
      mode: "validation_failed",
      id: prepared.id,
      error: "no_valid_erpnext_items",
      missing: prepared.missing
    };
  }

  if (!hasErpnextRestCredentials()) {
    return {
      mode: "validated_dry_run",
      id: prepared.id,
      marker: prepared.marker,
      customer: prepared.customer,
      erpCustomer: prepared.erpCustomer,
      validLines: prepared.validLines,
      missing: prepared.missing,
      fulfillment: prepared.fulfillment,
      nextAction: "configure_erpnext_rest_credentials"
    };
  }

  const quotation = await createDoc("Quotation", prepared.quotationDoc);
  const existing = await listDoc("Quotation", {
    filters: [["name", "=", quotation.name]],
    fields: ["name", "transaction_date", "grand_total", "status"],
    limit: 1
  });

  return {
    mode: "created",
    id: prepared.id,
    quotation: existing[0] || quotation,
    missing: prepared.missing,
    validLines: prepared.validLines,
    fulfillment: prepared.fulfillment
  };
}

export async function createQuoteRequest(payload = {}, account = null) {
  if (account) {
    const bound = bindQuoteToAccount(payload, account);
    if (bound.error) return { mode: "validation_failed", error: bound.error };
    payload = bound.payload;
  }
  const requestPayload = structuredClone({ ...payload, id: normalizeQuoteRequestId(payload.id) });
  return coalesceQuoteRequest(requestPayload, () =>
    withQuoteRequestLock(requestPayload.id, () => createQuoteRequestOnce(requestPayload, account))
  );
}

export async function getRecentWebsiteQuotes(limit = 12) {
  const [rows] = await getErpPool().execute(
    `
      SELECT name, owner, party_name, transaction_date, grand_total, status, creation, enq_det
      FROM \`tabQuotation\`
      WHERE enq_det LIKE '%Green Leaf Website Quote #%'
      ORDER BY creation DESC
      LIMIT :limit
    `,
    { limit: Math.min(Math.max(Number(limit) || 12, 1), 50) }
  );

  return rows.map((row) => ({
    name: row.name,
    owner: row.owner,
    customer: row.party_name,
    transactionDate: row.transaction_date,
    grandTotal: Number(row.grand_total || 0),
    status: row.status,
    creation: row.creation,
    marker: String(row.enq_det || "").split("\n")[0] || ""
  }));
}

export async function getWebsiteQuotesByEmail(email, limit = 20) {
  const cleanEmail = clean(email).toLowerCase();
  if (!cleanEmail) return [];

  const hasWebsiteEmail = await hasCustomField("Quotation", "website_customer_email");
  const maxLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const [rows] = hasWebsiteEmail
    ? await getErpPool().execute(
        `
          SELECT name, owner, party_name, transaction_date, valid_till, grand_total, status, order_type, creation, enq_det, website_customer_email
          FROM \`tabQuotation\`
          WHERE website_customer_email = :email
             OR enq_det LIKE :emailMarker
          ORDER BY creation DESC
          LIMIT :limit
        `,
        { email: cleanEmail, emailMarker: `%Email: ${cleanEmail}%`, limit: maxLimit }
      )
    : await getErpPool().execute(
        `
          SELECT name, owner, party_name, transaction_date, valid_till, grand_total, status, order_type, creation, enq_det
          FROM \`tabQuotation\`
          WHERE enq_det LIKE :emailMarker
          ORDER BY creation DESC
          LIMIT :limit
        `,
        { emailMarker: `%Email: ${cleanEmail}%`, limit: maxLimit }
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

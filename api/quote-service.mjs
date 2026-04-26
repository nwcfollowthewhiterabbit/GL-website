import { getErpPool } from "./erpnext-db.mjs";
import { createDoc, hasErpnextRestCredentials, listDoc } from "./erpnext-rest.mjs";
import { legacySyncRules } from "./legacy-sync-rules.mjs";

const DEFAULTS = legacySyncRules.quote.defaults;
const customFieldCache = new Map();

function clean(value) {
  return String(value || "").trim();
}

function quoteId() {
  return `GLQ-${Date.now()}`;
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
    .map((line) => ({
      sku: clean(line.sku || line.item_code || line.itemCode),
      qty: Number(line.qty || line.quantity || 1),
      rate: line.rate === undefined || line.rate === null || line.rate === "" ? null : Number(line.rate),
      note: clean(line.note)
    }))
    .filter((line) => line.sku && Number.isFinite(line.qty) && line.qty > 0);
}

async function getErpItemsBySku(skus, priceList = DEFAULTS.priceList) {
  if (!skus.length) return new Map();

  const placeholders = skus.map((_, index) => `:sku${index}`).join(", ");
  const params = Object.fromEntries(skus.map((sku, index) => [`sku${index}`, sku]));
  params.priceList = priceList;

  const [rows] = await getErpPool().execute(
    `
      SELECT
        i.name AS sku,
        i.item_name AS item_name,
        i.stock_uom,
        IFNULL(price.price_list_rate, 0) AS price,
        IFNULL(price.currency, :currency) AS currency
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
      WHERE i.name IN (${placeholders})
        AND IFNULL(i.disabled, 0) = 0
    `,
    { ...params, currency: process.env.DEFAULT_CURRENCY || "FJD" }
  );

  return new Map(rows.map((row) => [row.sku, row]));
}

async function findCustomerByEmail(email) {
  if (!email) return null;
  const [rows] = await getErpPool().execute(
    "SELECT name, customer_name FROM `tabCustomer` WHERE email_id = :email LIMIT 1",
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

async function existingQuotationByMarker(marker, id) {
  const hasWebsiteQuoteId = await hasCustomField("Quotation", "website_quote_id");
  const [rows] = hasWebsiteQuoteId
    ? await getErpPool().execute(
        "SELECT name FROM `tabQuotation` WHERE website_quote_id = :id OR enq_det LIKE :marker ORDER BY creation DESC LIMIT 1",
        { id, marker: `%${marker}%` }
      )
    : await getErpPool().execute(
        "SELECT name FROM `tabQuotation` WHERE enq_det LIKE :marker ORDER BY creation DESC LIMIT 1",
        { marker: `%${marker}%` }
      );
  return rows[0]?.name || null;
}

export async function prepareQuoteRequest(payload = {}) {
  const id = clean(payload.id) || quoteId();
  const marker = `Green Leaf Website Quote #${id}`;
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
    phone: clean(customer.phone)
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

    const rate = line.rate !== null && Number.isFinite(line.rate) ? line.rate : Number(item.price || 0);
    validLines.push({
      item_code: line.sku,
      item_name: item.item_name || line.sku,
      qty: line.qty,
      rate,
      uom: item.stock_uom || "Nos"
    });
  }

  const duplicateQuotation = await existingQuotationByMarker(marker, id);
  const erpCustomer = await getOrCreateCustomer(normalizedCustomer);

  const notes = [
    marker,
    normalizedCustomer.company ? `Company: ${normalizedCustomer.company}` : "",
    normalizedCustomer.contact ? `Contact: ${normalizedCustomer.contact}` : "",
    normalizedCustomer.email ? `Email: ${normalizedCustomer.email}` : "",
    normalizedCustomer.phone ? `Phone: ${normalizedCustomer.phone}` : "",
    clean(payload.notes) ? `Notes: ${clean(payload.notes)}` : "",
    missing.length ? `Missing SKU lines: ${missing.map((line) => line.sku).join(", ")}` : ""
  ].filter(Boolean);

  const quotationDoc = {
    doctype: "Quotation",
    quotation_to: "Customer",
    party_name: erpCustomer.name,
    company: process.env.ERP_COMPANY || DEFAULTS.company,
    transaction_date: new Date().toISOString().slice(0, 10),
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
    missing,
    duplicateQuotation,
    quotationDoc,
    canCreate: hasErpnextRestCredentials() && validLines.length > 0 && !duplicateQuotation
  };
}

export async function createQuoteRequest(payload = {}) {
  const prepared = await prepareQuoteRequest(payload);

  if (prepared.duplicateQuotation) {
    return {
      mode: "idempotent",
      id: prepared.id,
      quotation: prepared.duplicateQuotation,
      missing: prepared.missing,
      validLines: prepared.validLines
    };
  }

  if (!prepared.validLines.length) {
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
    validLines: prepared.validLines
  };
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

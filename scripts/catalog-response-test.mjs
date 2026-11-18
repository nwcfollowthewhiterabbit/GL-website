import { getAccountQuotationDetailByEmail } from "../api/account-service.mjs";
import assert from "node:assert/strict";
import { getCatalogProducts, getVisibleItemReference } from "../api/catalog-service.mjs";
import { getErpPool } from "../api/erpnext-db.mjs";
import { normalizeCategoryRule } from "../api/storefront-rules.mjs";

const pool = getErpPool();
const row = {
  sku: "SAMPLE", name: "Sample cups - $137.25", offer_count: 1, category: "Cups", uom: "50/Case",
  price: 137.25, currency: "FJD", price_mode_override: "Price List", packing_unit: 2,
  quantity: 12, availability: "available",
  description: "<p>Foam - $450</p><p>10cm US$1,200.20 cushion, 180*94*83-$5000</p><p>5mm glass -FJD&nbsp;20.50</p><p>Metal 29.99 FJD, 20 USD frame</p>"
};
const lookups = [];
pool.execute = async (sql, params) => {
  if (sql.includes("FROM `tabCustom Field`")) return [[{ name: params.fieldname }]];
  if (sql.includes("INFORMATION_SCHEMA.COLUMNS")) return [[{ COLUMN_NAME: "description" }]];
  if (sql.includes("AS offer_count")) {
    lookups.push({ sql, params });
    return [[row]];
  }
  if (sql.includes("AS price_mode")) return [[{
    sku: "FUR-AT-K1556-1", name: "5-Roller Hotdog Grill - 1/Case", stock_uom: "Case", price_mode: "Price List"
  }]];
  if (sql.includes("SELECT uom FROM")) return [[{ uom: "Each", price_list_rate: 137.25, currency: "FJD" }]];
  if (/FROM `tab(?:User|Contact|Customer)`/.test(sql)) return [[]];
  if (sql.includes("FROM `tabQuotation` q")) return [[{
    name: params.name, website_customer_email: "fixture@example.test", issued_total: params.name === "ISSUED" ? 137.25 : null
  }]];
  if (sql.includes("FROM `tabQuotation Item`")) return [[{
    item_code: row.sku, item_name: row.name, description: row.description, qty: 1, uom: row.uom,
    ...(sql.includes(", rate, amount") ? { rate: 137.25, amount: 137.25 } : {})
  }]];
  throw new Error("Unexpected catalog lookup");
};
try {
  const standard = await getCatalogProducts({ q: "sample" });
  const obsolete = await getCatalogProducts({ q: "sample", sort: "price_desc", minPrice: 150, maxPrice: 160 });
  assert.deepEqual(lookups[0], lookups[1]);
  assert.deepEqual(standard, obsolete);
  assert.equal(standard.total, 1);
  assert.equal(standard.products[0].description, "<p>Foam</p><p>10cm cushion, 180*94*83</p><p>5mm glass</p><p>Metal, frame</p>");
  assert.deepEqual(
    [standard.products[0].uom, standard.products[0].packingUnit, standard.products[0].quantity],
    ["50/Case", 2, 12]
  );
  const category = normalizeCategoryRule({
    name: "Cups", item_count: 1, website_price_mode: "Quote Only",
    website_price_list: "Private", website_show_products_without_price: 1
  });
  const enquiry = await getVisibleItemReference("FUR-AT-K1556-1", { withDetails: true });
  assert.equal(enquiry.uom, "Each");
  const draft = await getAccountQuotationDetailByEmail("fixture@example.test", "DRAFT");
  const issued = await getAccountQuotationDetailByEmail("fixture@example.test", "ISSUED");
  assert.equal(draft.lines[0].itemName, "Sample cups");
  assert.equal(draft.lines[0].description, standard.products[0].description);
  assert.equal(issued.lines[0].itemName, row.name);
  assert.equal(issued.lines[0].description, row.description);
  assert.equal(issued.lines[0].rate, 137.25);
  const publicData = JSON.stringify({ standard, category, enquiry, draft });
  assert.doesNotMatch(publicData, /"(?:price|priceMode|priceList|currency|amount|rate|showProductsWithoutPrice)"\s*:/i);
  assert.doesNotMatch(publicData, /137\.25|FJD|Private/);
} finally {
  await pool.end();
}

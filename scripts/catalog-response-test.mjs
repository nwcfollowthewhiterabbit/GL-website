import assert from "node:assert/strict";
import { getCatalogProducts, getVisibleItemReference } from "../api/catalog-service.mjs";
import { getErpPool } from "../api/erpnext-db.mjs";
import { normalizeCategoryRule } from "../api/storefront-rules.mjs";

const pool = getErpPool();
const row = {
  sku: "SAMPLE", name: "Sample cups", offer_count: 1, category: "Cups", uom: "50/Case",
  price: 137.25, currency: "FJD", price_mode_override: "Price List", packing_unit: 2,
  quantity: 12, availability: "available"
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
  throw new Error("Unexpected catalog lookup");
};
try {
  const standard = await getCatalogProducts({ q: "sample" });
  const obsolete = await getCatalogProducts({ q: "sample", sort: "price_desc", minPrice: 150, maxPrice: 160 });
  assert.deepEqual(lookups[0], lookups[1]);
  assert.deepEqual(standard, obsolete);
  assert.equal(standard.total, 1);
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
  const publicData = JSON.stringify({ standard, category, enquiry });
  assert.doesNotMatch(publicData, /"(?:price|priceMode|priceList|currency|amount|rate|showProductsWithoutPrice)"\s*:/i);
  assert.doesNotMatch(publicData, /137\.25|FJD|Private/);
} finally {
  await pool.end();
}

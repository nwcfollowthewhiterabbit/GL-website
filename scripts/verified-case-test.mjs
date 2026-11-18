import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { publicStockConversionSql, publicSellingUnitsSql } from "../api/selling-units.mjs";
import { getErpPool } from "../api/erpnext-db.mjs";
import { resolveSellingLines } from "../api/quote-service.mjs";

const db = new DatabaseSync(":memory:");
const expression = db.prepare(`
  WITH item(name, item_name, stock_uom, sales_uom, variant_of) AS (VALUES(?,?,?,?,?)),
       ip(uom) AS (VALUES(?)), conv(parent, conversion_factor) AS (VALUES(?,?))
  SELECT ${publicStockConversionSql} AS factor FROM item, ip, conv`);
const products = [
  ["REW-LPC", "2Ltr Magimix Gelato Expert, Stainless Steel - 1/Case", 3710],
  ["WIN-WB-29S", "Pipe Style Wine Bucket Stand For Wb-4 & Wb-4hv - 1/Case", 226.8]
];
for (const [sku, name, rate] of products) {
  function factor({ code = sku, title = name, stock = "Case", sales = "Case", template = null,
    unit = "Each", row = null, conversion = null } = {}) {
    return expression.get(code, title, stock, sales, template, unit, row, conversion).factor;
  }
  assert.equal(factor(), 1);
  const erp = new Map([[sku, [{ sku, item_name: name, uom: "Each", stock_uom: "Case",
    sales_uom: "Case", price: rate, available_quantity: 3, packing_unit: 1, conversion_factor: factor() }]]]);
  const { validLines, missing } = resolveSellingLines([{ sku, uom: "Each", qty: 2, expectedRate: rate }], erp);
  assert.deepEqual(missing, []);
  assert.deepEqual(validLines.map(line => [line.uom, line.stock_uom, line.conversion_factor, line.qty, line.rate]),
    [["Each", "Case", 1, 2, rate]]);
  assert.equal(factor({ code: "UNREVIEWED" }), null);
  assert.equal(factor({ title: name.replace("1/Case", "11/Case") }), null);
  assert.equal(factor({ title: "Replacement model - 1/Case" }), null);
  assert.equal(factor({ stock: "Box" }), null);
  assert.equal(factor({ sales: "Box" }), null);
  assert.equal(factor({ unit: "Pack" }), null);
  assert.equal(factor({ template: "NEW-TEMPLATE" }), null);
  assert.equal(factor({ row: sku, conversion: 0 }), 0);
  assert.equal(factor({ row: sku, conversion: 0.5 }), 0.5);
  assert.equal(factor({ row: sku, conversion: null }), null);
  assert.equal(factor({ unit: "Case" }), 1);
}
// Exercise the full SQL, including the distinct rates and eligible price scope.
const pool = getErpPool();
pool.execute = async () => [[]]; // No custom Item Group price list in this fixture.
db.exec(`
  CREATE TABLE \`tabItem\` (name TEXT, item_name TEXT, stock_uom TEXT, sales_uom TEXT, item_group TEXT, variant_of TEXT);
  CREATE TABLE \`tabItem Group\` (name TEXT);
  CREATE TABLE \`tabUOM Conversion Detail\` (parent TEXT, parenttype TEXT, parentfield TEXT, uom TEXT, conversion_factor REAL);
  CREATE TABLE \`tabItem Price\` (item_code TEXT, uom TEXT, price_list TEXT, currency TEXT, price_list_rate REAL,
    packing_unit REAL, valid_from TEXT, valid_upto TEXT, modified TEXT, docstatus INTEGER, selling INTEGER,
    customer TEXT, supplier TEXT, batch_no TEXT);
`);
const sku = "UNVERIFIED";
db.prepare("INSERT INTO \`tabItem\` VALUES (?, 'Other - 1/Case','Case','Case','General',NULL)").run(sku);
db.prepare("INSERT INTO \`tabItem Price\` VALUES (?, 'Each','Standard Selling','FJD',10,0,NULL,NULL,'2026-11-18',0,1,NULL,NULL,NULL)").run(sku);
const params = { priceList: "Standard Selling", currency: "FJD", priceDate: "2026-11-19" };
async function offers(options = {}) {
  const query = await publicSellingUnitsSql(options);
  return db.prepare(query).all(options.exactSku ? { ...params, exactSku: sku } : params);
}
assert.equal((await offers({ exactSku: true })).length, 0);
assert.equal((await offers({ requireConversion: false })).length, 0);
const enquiry = { exactSku: true, requireConversion: false };
assert.equal((await offers(enquiry))[0].price_list_rate, 10);
assert.equal((await offers(enquiry))[0].conversion_factor, null);
db.exec("INSERT INTO \`tabItem Price\` SELECT * FROM \`tabItem Price\`");
db.exec("UPDATE \`tabItem Price\` SET price_list_rate = 9 WHERE rowid = 2");
assert.equal((await offers(enquiry)).length, 0);
db.exec("UPDATE \`tabItem Price\` SET price_list_rate = 10, packing_unit = 2 WHERE rowid = 2");
assert.equal((await offers(enquiry)).length, 0);
db.exec("UPDATE \`tabItem Price\` SET customer = 'scoped' WHERE rowid = 2");
assert.equal((await offers(enquiry)).length, 1);
db.exec("UPDATE \`tabItem Price\` SET supplier = 'scoped' WHERE rowid = 1");
assert.equal((await offers(enquiry)).length, 0);
await pool.end();
db.close();
console.log("Verified case bindings, native master priority and quotation lines passed.");

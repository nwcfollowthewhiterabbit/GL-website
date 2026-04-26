import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getErpDbConfig, getErpPool } from "../api/erpnext-db.mjs";

const strict = process.argv.includes("--strict");
const integrationUser = process.env.ERPNEXT_INTEGRATION_USER || "website.integration@greenleaf.local";
const requiredRoles = ["System Manager", "Sales User", "Stock User"];
const requiredPriceList = process.env.DEFAULT_PRICE_LIST || "Standard Selling";
const requiredWarehouses = ["Showroom - GL", "Furniture Showroom (Upstairs) - GL"];
const fixturePath = fileURLToPath(new URL("../erpnext/fixtures/custom_fields.json", import.meta.url));

function status(ok) {
  return ok ? "ok" : "missing";
}

async function exists(sql, params) {
  const [rows] = await getErpPool().execute(sql, params);
  return Boolean(rows[0]);
}

async function count(sql, params) {
  const [rows] = await getErpPool().execute(sql, params);
  return Number(Object.values(rows[0] || { count: 0 })[0] || 0);
}

async function main() {
  const config = getErpDbConfig();
  const fixtures = JSON.parse(await readFile(fixturePath, "utf8"));
  const failures = [];

  console.log("ERPNext storefront readiness");
  console.log(`- DB: ${config.user}@${config.host}:${config.port}/${config.database}`);

  const dbReachable = await exists("SELECT 1 AS ok", {});
  console.log(`- Database reachable: ${status(dbReachable)}`);
  if (!dbReachable) failures.push("database");

  const userExists = await exists("SELECT name FROM `tabUser` WHERE name = :user LIMIT 1", { user: integrationUser });
  console.log(`- Integration user ${integrationUser}: ${status(userExists)}`);
  if (!userExists) failures.push(`user:${integrationUser}`);

  for (const role of requiredRoles) {
    const hasRole = await exists(
      "SELECT name FROM `tabHas Role` WHERE parent = :user AND role = :role AND parenttype = 'User' LIMIT 1",
      { user: integrationUser, role }
    );
    console.log(`- Role ${role}: ${status(hasRole)}`);
    if (!hasRole) failures.push(`role:${role}`);
  }

  const priceListExists = await exists("SELECT name FROM `tabPrice List` WHERE name = :priceList LIMIT 1", {
    priceList: requiredPriceList
  });
  console.log(`- Price list ${requiredPriceList}: ${status(priceListExists)}`);
  if (!priceListExists) failures.push(`price-list:${requiredPriceList}`);

  for (const warehouse of requiredWarehouses) {
    const warehouseExists = await exists("SELECT name FROM `tabWarehouse` WHERE name = :warehouse LIMIT 1", { warehouse });
    console.log(`- Excluded warehouse ${warehouse}: ${status(warehouseExists)}`);
    if (!warehouseExists) failures.push(`warehouse:${warehouse}`);
  }

  const catalogItems = await count(
    `
      SELECT COUNT(*) AS count
      FROM \`tabItem\` i
      JOIN \`tabItem Price\` ip ON ip.item_code = i.name
      WHERE IFNULL(i.disabled, 0) = 0
        AND IFNULL(i.is_sales_item, 1) = 1
        AND ip.price_list = :priceList
        AND ip.docstatus = 0
        AND IFNULL(ip.price_list_rate, 0) > 0
    `,
    { priceList: requiredPriceList }
  );
  console.log(`- Enabled priced sales items: ${catalogItems.toLocaleString()}`);
  if (!catalogItems) failures.push("priced-sales-items");

  const missingFields = [];
  for (const field of fixtures) {
    const fieldExists = await exists("SELECT name FROM `tabCustom Field` WHERE dt = :dt AND fieldname = :fieldname LIMIT 1", {
      dt: field.dt,
      fieldname: field.fieldname
    });
    console.log(`- Custom field ${field.dt}.${field.fieldname}: ${status(fieldExists)}`);
    if (!fieldExists) missingFields.push(`${field.dt}.${field.fieldname}`);
  }

  if (missingFields.length) {
    console.log("- Custom field patch: pending");
    console.log(`  Apply erpnext/fixtures/custom_fields.json before production. Missing: ${missingFields.join(", ")}`);
    if (strict) failures.push(...missingFields.map((field) => `custom-field:${field}`));
  } else {
    console.log("- Custom field patch: ok");
  }

  if (failures.length) {
    console.log(`Validation completed with ${failures.length} issue(s).`);
    if (strict) {
      process.exitCode = 1;
    }
  } else {
    console.log("Validation passed.");
  }
}

main()
  .catch((error) => {
    console.error(`ERPNext validation failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getErpPool().end();
    } catch {
      // Ignore close errors after failed connection attempts.
    }
  });

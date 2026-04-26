import "dotenv/config";
import mysql from "mysql2/promise";

const config = {
  host: process.env.ERPNEXT_DB_HOST || "127.0.0.1",
  port: Number(process.env.ERPNEXT_DB_PORT || 3306),
  user: process.env.ERPNEXT_DB_USER || "root",
  password: process.env.ERPNEXT_DB_PASSWORD,
  database: process.env.ERPNEXT_DB_NAME
};

if (!config.password || !config.database) {
  console.error("Missing ERPNext DB env vars. See .env.example.");
  process.exit(1);
}

const db = await mysql.createConnection(config);

const [counts] = await db.query(`
  SELECT
    (SELECT COUNT(*) FROM \`tabItem\`) items,
    (SELECT COUNT(*) FROM \`tabItem Group\`) item_groups,
    (SELECT COUNT(*) FROM \`tabItem Price\`) item_prices,
    (SELECT COUNT(*) FROM \`tabCustomer\`) customers,
    (SELECT COUNT(*) FROM \`tabQuotation\`) quotations,
    (SELECT COUNT(*) FROM \`tabSales Order\`) sales_orders
`);

const [itemGroups] = await db.query(`
  SELECT item_group, COUNT(*) item_count
  FROM \`tabItem\`
  WHERE disabled = 0
  GROUP BY item_group
  ORDER BY item_count DESC
  LIMIT 50
`);

const [priceLists] = await db.query(`
  SELECT price_list, currency, COUNT(*) price_count
  FROM \`tabItem Price\`
  GROUP BY price_list, currency
  ORDER BY price_count DESC
  LIMIT 50
`);

await db.end();

console.log(JSON.stringify({ counts: counts[0], itemGroups, priceLists }, null, 2));

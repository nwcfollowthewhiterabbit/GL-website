import "dotenv/config";
import mysql from "mysql2/promise";

const config = {
  host: process.env.OPENCART_DB_HOST || "127.0.0.1",
  port: Number(process.env.OPENCART_DB_PORT || 3306),
  user: process.env.OPENCART_DB_USER,
  password: process.env.OPENCART_DB_PASSWORD,
  database: process.env.OPENCART_DB_NAME
};

if (!config.user || !config.password || !config.database) {
  console.error("Missing OpenCart DB env vars. See .env.example.");
  process.exit(1);
}

const db = await mysql.createConnection(config);

const [counts] = await db.query(`
  SELECT
    (SELECT COUNT(*) FROM oc_product) products,
    (SELECT COUNT(*) FROM oc_product WHERE status = 1) active_products,
    (SELECT COUNT(*) FROM oc_category) categories,
    (SELECT COUNT(*) FROM oc_manufacturer) manufacturers,
    (SELECT COUNT(*) FROM oc_product_image) product_images,
    (SELECT COUNT(*) FROM oc_customer) customers
`);

const [topCategories] = await db.query(`
  SELECT c.category_id, c.parent_id, cd.name, c.status, c.sort_order
  FROM oc_category c
  JOIN oc_category_description cd
    ON cd.category_id = c.category_id AND cd.language_id = 2
  WHERE c.parent_id = 0
  ORDER BY c.sort_order, cd.name
`);

const [manufacturers] = await db.query(`
  SELECT manufacturer_id, name
  FROM oc_manufacturer
  ORDER BY name
`);

await db.end();

console.log(JSON.stringify({ counts: counts[0], topCategories, manufacturers }, null, 2));

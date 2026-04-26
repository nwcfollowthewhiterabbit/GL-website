import mysql from "mysql2/promise";

const DEFAULT_ERP_DB_HOST = "erp-greenleafpacific-local-db-1";
const DEFAULT_ERP_DB_NAME = "_03f9d53928a8e321";

export function getErpDbConfig() {
  return {
    host: process.env.ERPNEXT_DB_HOST || DEFAULT_ERP_DB_HOST,
    port: Number(process.env.ERPNEXT_DB_PORT || 3306),
    user: process.env.ERPNEXT_DB_USER || "root",
    password: process.env.ERPNEXT_DB_PASSWORD || process.env.DB_ROOT_PASSWORD || "",
    database: process.env.ERPNEXT_DB_NAME || process.env.SITE_DB_NAME || DEFAULT_ERP_DB_NAME,
    waitForConnections: true,
    connectionLimit: 8,
    namedPlaceholders: true
  };
}

let pool;

export function getErpPool() {
  if (!pool) {
    pool = mysql.createPool(getErpDbConfig());
  }
  return pool;
}

export async function pingErpDb() {
  const [rows] = await getErpPool().query("SELECT 1 AS ok");
  return rows?.[0]?.ok === 1;
}

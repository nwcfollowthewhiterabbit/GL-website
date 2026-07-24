import mysql from "mysql2/promise";

const DEFAULT_ERP_DB_HOST = "erp-greenleafpacific-local-db-1";
const DEFAULT_ERP_DB_NAME = "_03f9d53928a8e321";

export function getErpDbConfig() {
  const production = process.env.NODE_ENV === "production";
  const explicitUser = String(process.env.ERPNEXT_DB_USER || "").trim();
  const explicitPassword = String(process.env.ERPNEXT_DB_PASSWORD || "");
  const user = explicitUser || (production ? "" : "root");
  const password = explicitPassword || (production ? "" : process.env.DB_ROOT_PASSWORD || "");

  if (production && (!user || !password || user.toLowerCase() === "root")) {
    throw new Error("production_erp_database_credentials_must_be_non_root");
  }

  return {
    host: process.env.ERPNEXT_DB_HOST || DEFAULT_ERP_DB_HOST,
    port: Number(process.env.ERPNEXT_DB_PORT || 3306),
    user,
    password,
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

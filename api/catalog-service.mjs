import { getErpPool } from "./erpnext-db.mjs";
import { availableCustomFields, getCategoryRule, getCategoryRules } from "./storefront-rules.mjs";

const DEFAULT_PRICE_LIST = process.env.DEFAULT_PRICE_LIST || "Standard Selling";
const EXCLUDED_WAREHOUSES = ["Showroom - GL", "Furniture Showroom (Upstairs) - GL"];
const EXCLUDED_STOREFRONT_GROUPS = [
  "Expences",
  "Freight",
  "Fuel",
  "Labor",
  "Office Expences",
  "Raw Material",
  "Sub Assemblies",
  "TAXES",
  "Utility"
];

function normalizePage(value, fallback, max) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function itemWhere({ q, category, includeHidden, includeWeakGroups, categoryRule, hasItemFields }) {
  const clauses = [
    "IFNULL(i.disabled, 0) = 0",
    "IFNULL(i.is_sales_item, 1) = 1",
    "IFNULL(i.has_variants, 0) = 0",
    "i.name <> ''"
  ];
  const params = {};

  if (hasItemFields.website_show_on_storefront) {
    clauses.push("IFNULL(i.website_show_on_storefront, 1) = 1");
  }

  if (!includeHidden && !categoryRule.showProductsWithoutPrice && categoryRule.priceMode === "Price List") {
    clauses.push("price.price_list_rate > 0");
  }

  if (!includeHidden && !categoryRule.showProductsWithoutImages) {
    clauses.push("IFNULL(i.image, '') <> ''");
  }

  if (!includeWeakGroups) {
    const excluded = EXCLUDED_STOREFRONT_GROUPS.map((_, index) => `:excludedGroup${index}`).join(", ");
    clauses.push(`IFNULL(i.item_group, '') NOT IN (${excluded})`);
  }

  if (q) {
    params.q = `%${q}%`;
    clauses.push("(i.name LIKE :q OR i.item_name LIKE :q OR i.item_group LIKE :q OR i.description LIKE :q)");
  }

  if (category) {
    params.category = category;
    clauses.push("i.item_group = :category");
  }

  return { sql: clauses.join(" AND "), params };
}

function itemBaseSql(priceList = DEFAULT_PRICE_LIST) {
  const excluded = EXCLUDED_WAREHOUSES.map((_, index) => `:excludedWarehouse${index}`).join(", ");
  return `
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
      ) latest
        ON latest.item_code = ip.item_code AND latest.modified = ip.modified
      WHERE ip.price_list = :priceList
        AND ip.docstatus = 0
    ) price ON price.item_code = i.name
    LEFT JOIN (
      SELECT b.item_code, SUM(b.actual_qty) AS actual_qty
      FROM \`tabBin\` b
      JOIN \`tabWarehouse\` w ON w.name = b.warehouse
      WHERE IFNULL(w.disabled, 0) = 0
        AND w.name NOT IN (${excluded})
        AND LOWER(w.name) NOT LIKE '%showroom%'
      GROUP BY b.item_code
    ) stock ON stock.item_code = i.name
  `;
}

function baseParams(priceList = DEFAULT_PRICE_LIST) {
  return {
    priceList,
    excludedWarehouse0: EXCLUDED_WAREHOUSES[0],
    excludedWarehouse1: EXCLUDED_WAREHOUSES[1]
  };
}

export async function getCatalogProducts(options = {}) {
  const page = normalizePage(options.page, 1, 100000);
  const pageSize = normalizePage(options.pageSize, 24, 100);
  const offset = (page - 1) * pageSize;
  const q = String(options.q || "").trim();
  const category = String(options.category || "").trim();
  const includeHidden = String(options.includeHidden || "") === "1";
  const includeWeakGroups = String(options.includeWeakGroups || "") === "1";
  const categoryRule = await getCategoryRule(category);
  if (category && !includeHidden && !categoryRule.showOnStorefront) {
    return {
      page,
      pageSize,
      total: 0,
      priceList: categoryRule.priceList || DEFAULT_PRICE_LIST,
      categoryRule,
      products: []
    };
  }

  const priceList = String(options.priceList || categoryRule.priceList || DEFAULT_PRICE_LIST).trim() || DEFAULT_PRICE_LIST;
  const hasItemFields = await availableCustomFields("Item", [
    "website_show_on_storefront",
    "website_price_mode_override",
    "website_stock_display_override",
    "website_sort_order",
    "website_featured"
  ]);

  const base = itemBaseSql(priceList);
  const where = itemWhere({ q, category, includeHidden, includeWeakGroups, categoryRule, hasItemFields });
  const params = {
    ...baseParams(priceList),
    ...where.params,
    limit: pageSize,
    offset
  };
  EXCLUDED_STOREFRONT_GROUPS.forEach((group, index) => {
    params[`excludedGroup${index}`] = group;
  });

  const pool = getErpPool();
  const [rows] = await pool.execute(
    `
      SELECT
        i.name AS sku,
        i.item_name AS name,
        i.item_group AS category,
        i.stock_uom AS uom,
        i.image,
        IFNULL(NULLIF(i.web_long_description, ''), i.description) AS description,
        IFNULL(price.price_list_rate, 0) AS price,
        IFNULL(price.currency, :defaultCurrency) AS currency,
        GREATEST(FLOOR(IFNULL(stock.actual_qty, 0)), 0) AS quantity,
        ${hasItemFields.website_price_mode_override ? "i.website_price_mode_override" : "NULL"} AS price_mode_override,
        ${hasItemFields.website_stock_display_override ? "i.website_stock_display_override" : "NULL"} AS stock_display_override,
        ${hasItemFields.website_sort_order ? "IFNULL(i.website_sort_order, 0)" : "0"} AS website_sort_order,
        CASE
          WHEN IFNULL(price.price_list_rate, 0) <= 0 THEN 'hidden_no_price'
          WHEN IFNULL(stock.actual_qty, 0) <= 0 THEN 'special_order'
          ELSE 'available'
        END AS availability
      ${base}
      WHERE ${where.sql}
      ORDER BY website_sort_order, i.modified DESC
      LIMIT :limit OFFSET :offset
    `,
    { ...params, defaultCurrency: process.env.DEFAULT_CURRENCY || "FJD" }
  );

  const [countRows] = await pool.execute(
    `
      SELECT COUNT(*) AS total
      ${base}
      WHERE ${where.sql}
    `,
    params
  );

  return {
    page,
    pageSize,
    total: Number(countRows[0]?.total || 0),
    priceList,
    categoryRule,
    products: rows.map((row) => {
      const priceMode = row.price_mode_override || categoryRule.priceMode;
      return {
        priceMode,
        stockDisplay: row.stock_display_override || categoryRule.stockDisplay,
        sku: row.sku,
        name: row.name || row.sku,
        category: row.category || "All Item Groups",
        uom: row.uom || "Nos",
        image: row.image || null,
        description: row.description || "",
        price: priceMode === "Price List" ? Number(row.price || 0) : priceMode,
        currency: row.currency || process.env.DEFAULT_CURRENCY || "FJD",
        quantity: Number(row.quantity || 0),
        availability: row.availability
      };
    })
  };
}

export async function getCatalogItemGroups() {
  return getCategoryRules();
}

export async function getCatalogProductBySku(sku) {
  const result = await getCatalogProducts({ q: sku, includeHidden: "1", pageSize: 25 });
  return result.products.find((product) => product.sku === sku) || null;
}

export async function getCatalogDiagnostics() {
  const [rows] = await getErpPool().execute(
    `
      SELECT
        COUNT(*) AS total_items,
        SUM(CASE WHEN IFNULL(i.disabled, 0) = 0 THEN 1 ELSE 0 END) enabled_items,
        SUM(CASE WHEN IFNULL(i.image, '') = '' THEN 1 ELSE 0 END) without_image,
        SUM(CASE WHEN IFNULL(i.item_group, '') IN ('', 'All Item Groups') THEN 1 ELSE 0 END) weak_group,
        SUM(CASE WHEN IFNULL(price.price_list_rate, 0) <= 0 THEN 1 ELSE 0 END) without_selling_price
      FROM \`tabItem\` i
      LEFT JOIN (
        SELECT item_code, MAX(price_list_rate) AS price_list_rate
        FROM \`tabItem Price\`
        WHERE price_list = :priceList
          AND docstatus = 0
          AND (valid_upto IS NULL OR valid_upto >= CURDATE())
        GROUP BY item_code
      ) price ON price.item_code = i.name
      WHERE IFNULL(i.is_sales_item, 1) = 1
        AND IFNULL(i.has_variants, 0) = 0
    `,
    { priceList: DEFAULT_PRICE_LIST }
  );

  const [groups] = await getErpPool().execute(
    `
      SELECT i.item_group, COUNT(*) AS item_count
      FROM \`tabItem\` i
      WHERE IFNULL(i.disabled, 0) = 0
        AND IFNULL(i.is_sales_item, 1) = 1
        AND IFNULL(i.has_variants, 0) = 0
      GROUP BY i.item_group
      ORDER BY item_count DESC
      LIMIT 20
    `
  );

  return {
    priceList: DEFAULT_PRICE_LIST,
    storefrontRules: {
      excludedGroups: EXCLUDED_STOREFRONT_GROUPS,
      excludedWarehouses: EXCLUDED_WAREHOUSES,
      defaultCurrency: process.env.DEFAULT_CURRENCY || "FJD",
      source: "ERPNext Item Group website fields when present"
    },
    totals: rows[0],
    topGroups: groups
  };
}

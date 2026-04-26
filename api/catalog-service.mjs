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

function parseCategoryList(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => parseCategoryList(item));
  }
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function itemWhere({ q, category, categoryNames, categories, featured, includeHidden, includeWeakGroups, categoryRule, hasItemFields }) {
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

  if (featured && hasItemFields.website_featured) {
    clauses.push("IFNULL(i.website_featured, 0) = 1");
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
    const selectedCategories = categoryNames.length ? categoryNames : [category];
    const categoryPlaceholders = selectedCategories.map((_, index) => `:selectedCategory${index}`).join(", ");
    selectedCategories.forEach((itemGroup, index) => {
      params[`selectedCategory${index}`] = itemGroup;
    });
    clauses.push(`i.item_group IN (${categoryPlaceholders})`);
  } else if (categories.length) {
    const categoryPlaceholders = categories.map((_, index) => `:category${index}`).join(", ");
    categories.forEach((itemGroup, index) => {
      params[`category${index}`] = itemGroup;
    });
    clauses.push(`i.item_group IN (${categoryPlaceholders})`);
  }

  return { sql: clauses.join(" AND "), params };
}

async function getItemGroupBranchNames(category) {
  if (!category) return [];

  const [rows] = await getErpPool().execute(
    `
      SELECT child.name
      FROM \`tabItem Group\` parent
      JOIN \`tabItem Group\` child
        ON child.lft >= parent.lft
       AND child.rgt <= parent.rgt
      WHERE parent.name = :category
      ORDER BY child.lft
    `,
    { category }
  );

  const names = rows.map((row) => row.name).filter(Boolean);
  return names.length ? names : [category];
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
  const featured = String(options.featured || "") === "1";
  const categories = parseCategoryList(options.categories).filter((item) => item !== category);
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
  const categoryNames = category ? await getItemGroupBranchNames(category) : [];
  const where = itemWhere({ q, category, categoryNames, categories, featured, includeHidden, includeWeakGroups, categoryRule, hasItemFields });
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

export async function getFeaturedCatalogProducts(limit = 8) {
  const managedProducts = await getManagedFeaturedProducts(limit);
  if (managedProducts.length) {
    return { source: "erp_website_featured_product", products: managedProducts };
  }

  const hasItemFields = await availableCustomFields("Item", ["website_featured"]);
  if (hasItemFields.website_featured) {
    const result = await getCatalogProducts({
      featured: "1",
      pageSize: normalizePage(limit, 8, 24)
    });
    if (result.products.length) {
      return { source: "erp_item_website_featured", products: result.products };
    }
  }

  const result = await getCatalogProducts({
    pageSize: normalizePage(limit, 8, 24)
  });
  return { source: hasItemFields.website_featured ? "fallback_catalog_latest" : "fallback_missing_custom_field", products: result.products };
}

async function tableExists(tableName) {
  const [rows] = await getErpPool().execute(
    `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :tableName
      LIMIT 1
    `,
    { tableName }
  );
  return Boolean(rows[0]);
}

async function getManagedFeaturedProducts(limit = 8) {
  if (!(await tableExists("tabWebsite Featured Product"))) return [];

  const max = normalizePage(limit, 8, 24);
  const [rows] = await getErpPool().execute(
    `
      SELECT item_code
      FROM \`tabWebsite Featured Product\`
      WHERE IFNULL(enabled, 1) = 1
        AND IFNULL(item_code, '') <> ''
      ORDER BY IFNULL(sort_order, 0), idx, creation
      LIMIT :limit
    `,
    { limit: max }
  );

  const products = [];
  for (const row of rows) {
    const product = await getCatalogProductBySku(row.item_code);
    if (product) products.push(product);
  }

  return products;
}

export async function getCatalogSuggestions(query, limit = 8) {
  const q = String(query || "").trim();
  if (!q) return [];

  const max = normalizePage(limit, 8, 12);
  const lower = q.toLowerCase();
  const [catalogResult, categoryRules] = await Promise.all([
    getCatalogProducts({ q, pageSize: max }),
    getCategoryRules()
  ]);

  const categorySuggestions = categoryRules
    .filter(
      (group) =>
        group.itemCount > 0 &&
        group.showOnStorefront !== false &&
        [group.name, group.parent || ""].some((value) => value.toLowerCase().includes(lower))
    )
    .sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(lower) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(lower) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return b.itemCount - a.itemCount;
    })
    .slice(0, 4)
    .map((group) => ({
      id: `item_group:${group.name}`,
      type: "item_group",
      label: group.name,
      detail: group.parent ? `${group.parent} - ${Number(group.itemCount || 0).toLocaleString()} items` : `${Number(group.itemCount || 0).toLocaleString()} items`,
      category: group.name
    }));

  const productSuggestions = catalogResult.products.map((product) => ({
    id: `product:${product.sku}`,
    type: "product",
    label: product.name,
    detail: `${product.sku} - ${product.category}`,
    sku: product.sku,
    category: product.category,
    image: product.image || null
  }));

  return [...categorySuggestions, ...productSuggestions].slice(0, max);
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

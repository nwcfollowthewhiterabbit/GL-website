import { reviewedEnquiryDescription, reviewedProductDescription, reviewedProductImage } from "./reviewed-product-specs.mjs";
import { readFileSync } from "node:fs";
import { cachePublicRead } from "./public-read-cache.mjs";
import { displayItemName, withoutEmbeddedPrices } from "./catalog-verified-content.mjs";
import { publicPriceSummarySql, publicSellingUnitsSql, sellingName, storePriceParams } from "./selling-units.mjs";
import { getErpPool } from "./erpnext-db.mjs";
import { availableCustomFields, getCategoryRule, getCategoryRules } from "./storefront-rules.mjs";
import { EXCLUDED_STOREFRONT_GROUPS, getCatalogPublicationSql } from "./catalog-publication-rules.mjs";

const enquiryUnits = new Map(JSON.parse(readFileSync(new URL("./enquiry-price-units.json", import.meta.url), "utf8"))
  .map(([sku, name, uom, stockUom]) => [sku, { name, uom, stockUom }]));

const EXCLUDED_WAREHOUSES = ["Showroom - GL", "Furniture Showroom (Upstairs) - GL"];
export { EXCLUDED_STOREFRONT_GROUPS } from "./catalog-publication-rules.mjs";

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

function itemWhere({ q, category, categoryNames, categories, featured, includeHidden, includeWeakGroups, hasItemFields, hasGroupFields, productReadySql }) {
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

  if (hasGroupFields.website_show_on_storefront) {
    clauses.push("IFNULL(ig.website_show_on_storefront, 1) = 1");
  }

  if (featured && hasItemFields.website_featured) {
    clauses.push("IFNULL(i.website_featured, 0) = 1");
  }

  if (!includeHidden) clauses.push(productReadySql);

  if (!includeWeakGroups) {
    const excluded = EXCLUDED_STOREFRONT_GROUPS.map((_, index) => `:excludedGroup${index}`).join(", ");
    clauses.push(`IFNULL(i.item_group, '') NOT IN (${excluded})`);
  }

  if (q) {
    params.q = `%${q}%`;
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

export async function getVisibleItemReference(sku, { withDetails = false } = {}) {
  const [hasItemFields, hasGroupFields, publication] = await Promise.all([
    availableCustomFields("Item", ["website_show_on_storefront", "website_price_mode_override"]),
    availableCustomFields("Item Group", ["website_show_on_storefront", "website_price_mode"]),
    getCatalogPublicationSql()
  ]);
  const where = itemWhere({ categories: [], hasItemFields, hasGroupFields, includeHidden: true });
  const params = { sku };
  EXCLUDED_STOREFRONT_GROUPS.forEach((group, index) => { params[`excludedGroup${index}`] = group; });
  const [rows] = await getErpPool().execute(
    `SELECT i.name AS sku, COALESCE(NULLIF(i.item_name, ''), i.name) AS name, i.stock_uom, i.item_group,
            ${withDetails && publication.hasSpecFields ? "i.manufacturer, i.manufacturer_part_no, i.image," : ""}
            COALESCE(${hasItemFields.website_price_mode_override ? "NULLIF(i.website_price_mode_override, '')" : "NULL"},
                     ${hasGroupFields.website_price_mode ? "NULLIF(ig.website_price_mode, '')" : "NULL"}, 'Price List') AS price_mode
     FROM \`tabItem\` i LEFT JOIN \`tabItem Group\` ig ON ig.name = i.item_group
     WHERE i.name = :sku AND ${where.sql} LIMIT 1`, params
  );
  const row = rows[0];
  if (!row || row.sku !== sku) return null;
  const reference = { sku: row.sku, name: withoutEmbeddedPrices(displayItemName(row.sku, row.name)) || row.sku };
  if (withDetails) reference.description = withoutEmbeddedPrices(reviewedEnquiryDescription(row), row.sku);
  const reviewed = withDetails && enquiryUnits.get(sku);
  if (!reviewed || reviewed.name.trim() !== row.name.trim() || reviewed.stockUom !== row.stock_uom) return reference;
  if (row.price_mode !== "Price List") return reference;

  const sql = await publicSellingUnitsSql({ exactSku: true, requireConversion: false });
  const [units] = await getErpPool().execute(
    `SELECT uom FROM (${sql}) prices
     WHERE uom = :reviewedUom AND packing_unit <= 1`,
    { ...storePriceParams(), exactSku: sku, reviewedUom: reviewed.uom }
  );
  if (units.length === 1 && units[0].uom === reviewed.uom) reference.uom = reviewed.uom;
  return reference;
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

async function itemBaseSql({ exactSku = false, search = false, featured = false } = {}) {
  const excluded = EXCLUDED_WAREHOUSES.map((_, index) => `:excludedWarehouse${index}`).join(", ");
  return `
    FROM \`tabItem\` i
    JOIN (${await publicSellingUnitsSql({ exactSku, search, featured, requireImage: true })}) price ON price.item_code = i.name
    LEFT JOIN (
      SELECT b.item_code, SUM(b.actual_qty) AS actual_qty
      FROM \`tabBin\` b
      JOIN \`tabWarehouse\` w ON w.name = b.warehouse
      WHERE IFNULL(w.disabled, 0) = 0
        ${exactSku ? "AND b.item_code = :exactSku" : ""}
        AND w.name NOT IN (${excluded})
        AND LOWER(w.name) NOT LIKE '%showroom%'
      GROUP BY b.item_code
    ) stock ON stock.item_code = i.name
    LEFT JOIN \`tabItem Group\` ig ON ig.name = i.item_group
  `;
}

async function catalogQualityBaseSql() {
  return `FROM \`tabItem\` i
    LEFT JOIN (${await publicPriceSummarySql()}) price ON price.item_code = i.name`;
}

function baseParams() {
  return {
    ...storePriceParams(),
    excludedWarehouse0: EXCLUDED_WAREHOUSES[0],
    excludedWarehouse1: EXCLUDED_WAREHOUSES[1]
  };
}

const firstCatalogPage = cachePublicRead(() => loadCatalogProducts({ pageSize: 24 }), 15_000);

export function getCatalogProducts(options = {}, { includeTotal = true } = {}) {
  const pageSize = normalizePage(options.pageSize, 24, 100);
  const firstPage = normalizePage(options.page, 1, 1000) === 1 && pageSize <= 24
    && (!options.sort || options.sort === "featured")
    && !options.q && !options.category && !options.categories && !options.featured
    && !options.exactSku && !options.exactUom;
  if (firstPage) {
    return firstCatalogPage().then(page => ({ ...page, pageSize, products: page.products.slice(0, pageSize) }));
  }
  return loadCatalogProducts(options, includeTotal);
}

async function loadCatalogProducts(options, includeTotal = true) {
  const page = normalizePage(options.page, 1, 1000);
  const pageSize = normalizePage(options.pageSize, 24, 100);
  const offset = (page - 1) * pageSize;
  const q = String(options.q || "").trim().slice(0, 100);
  const category = String(options.category || "").trim().slice(0, 140);
  const featured = String(options.featured || "") === "1";
  const categories = parseCategoryList(options.categories)
    .slice(0, 50)
    .map((item) => item.slice(0, 140))
    .filter((item) => item !== category);
  const includeHidden = false;
  const includeWeakGroups = false;
  const sort = String(options.sort || "featured").trim();
  const categoryRule = await getCategoryRule(category);
  if (category && !includeHidden && !categoryRule.showOnStorefront) {
    return {
      page,
      pageSize,
      total: 0,
      categoryRule,
      products: []
    };
  }

  const [hasItemFields, hasGroupFields, publication] = await Promise.all([
    availableCustomFields("Item", [
      "website_show_on_storefront",
      "website_stock_display_override",
      "website_sort_order",
      "website_featured"
    ]),
    availableCustomFields("Item Group", ["website_show_on_storefront"]),
    getCatalogPublicationSql()
  ]);

  const base = await itemBaseSql({
    exactSku: Boolean(options.exactSku),
    search: Boolean(q),
    featured: featured && hasItemFields.website_featured
  });
  const categoryNames = category ? await getItemGroupBranchNames(category) : [];
  const where = itemWhere({ q, category, categoryNames, categories, featured, includeHidden, includeWeakGroups, hasItemFields, hasGroupFields, productReadySql: publication.productReady });
  if (options.exactSku) {
    where.sql += " AND i.name = :exactSku";
    where.params.exactSku = options.exactSku;
  }
  if (options.exactUom) {
    where.sql += " AND price.uom = :exactUom";
    where.params.exactUom = options.exactUom;
  }
  const params = {
    ...baseParams(),
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
        ${includeTotal ? "COUNT(*) OVER () AS offer_count," : ""}
        i.name AS sku,
        i.item_name AS name,
        i.item_group AS category,
        price.uom, i.sales_uom, price.packing_unit,
        ${publication.imageValue} AS image,
        ${publication.descriptionValue} AS description, ${publication.specMatch} AS reviewed_asset,
        (${publication.primaryReady}) AS primary_description_ready,
        GREATEST(FLOOR(IFNULL(stock.actual_qty, 0) / price.conversion_factor), 0) AS quantity,
        ${hasItemFields.website_stock_display_override ? "i.website_stock_display_override" : "NULL"} AS stock_display_override,
        ${hasItemFields.website_sort_order ? "IFNULL(i.website_sort_order, 0)" : "0"} AS website_sort_order,
        CASE
          WHEN IFNULL(price.price_list_rate, 0) <= 0 THEN 'hidden_no_price'
          WHEN IFNULL(stock.actual_qty, 0) < price.conversion_factor * GREATEST(1, price.packing_unit) THEN 'special_order'
          ELSE 'available'
        END AS availability
      ${base}
      WHERE ${where.sql}
      ORDER BY ${catalogOrderBy(sort)}, i.name, (price.uom = i.sales_uom) DESC, price.uom
      LIMIT :limit OFFSET :offset
    `,
    params
  );

  // An out-of-range page has no row to carry the window count.
  let total = Number(rows[0]?.offer_count || 0);
  if (includeTotal && !rows.length && page > 1) {
    const [countRows] = await pool.execute(
      `
        SELECT COUNT(*) AS total
        ${base}
        WHERE ${where.sql}
      `,
      params
    );
    total = Number(countRows[0]?.total || 0);
  }

  return {
    page,
    pageSize,
    ...(includeTotal ? { total } : {}),
    categoryRule,
    products: rows.map((row) => {
      return {
        stockDisplay: row.stock_display_override || categoryRule.stockDisplay,
        sku: row.sku,
        name: withoutEmbeddedPrices(displayItemName(row.sku, sellingName(row.name || row.sku, row.sales_uom, row.uom))) || row.sku,
        category: row.category || "All Item Groups",
        uom: row.uom || "Nos",
        packingUnit: Number(row.packing_unit || 0),
        image: row.reviewed_asset ? reviewedProductImage(row.sku) : (row.image || null),
        description: withoutEmbeddedPrices(row.reviewed_asset && !row.primary_description_ready ? reviewedProductDescription(row.sku) : (row.description || ""), row.sku),
        quantity: Number(row.quantity || 0),
        availability: row.availability
      };
    })
  };
}

function catalogOrderBy(sort) {
  switch (sort) {
    case "name_asc":
      return "i.item_name ASC, i.name ASC";
    case "name_desc":
      return "i.item_name DESC, i.name DESC";
    default:
      return "website_sort_order, CASE WHEN IFNULL(stock.actual_qty, 0) > 0 THEN 0 ELSE 1 END, i.modified DESC";
  }
}

const defaultFeatured = cachePublicRead(() => loadFeaturedCatalogProducts(8), 15_000);

export function getFeaturedCatalogProducts(limit = 8) {
  const size = normalizePage(limit, 8, 24);
  return size === 8 ? defaultFeatured() : loadFeaturedCatalogProducts(size);
}

async function loadFeaturedCatalogProducts(limit) {
  const managedProducts = await getManagedFeaturedProducts(limit);
  if (managedProducts.length) {
    return { source: "erp_website_featured_product", products: managedProducts };
  }

  const hasItemFields = await availableCustomFields("Item", ["website_featured"]);
  if (hasItemFields.website_featured) {
    const result = await getCatalogProducts({
      featured: "1",
      pageSize: normalizePage(limit, 8, 24)
    }, { includeTotal: false });
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
    getCatalogProducts({ q, pageSize: max }, { includeTotal: false }),
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
    id: JSON.stringify(["product", product.sku, product.uom]),
    type: "product",
    label: product.name,
    detail: `${product.sku} · ${product.uom} · ${product.category}`,
    uom: product.uom,
    sku: product.sku,
    category: product.category,
    image: product.image || null
  }));

  return [...categorySuggestions, ...productSuggestions].slice(0, max);
}

export async function getCatalogItemGroups() {
  return getCategoryRules();
}

export async function getCatalogProductBySku(sku, uom = "") {
  const result = await getCatalogProducts({ exactSku: sku, exactUom: uom, pageSize: 1 });
  return result.products.length ? { ...result.products[0], sellingUnitCount: result.total } : null;
}

export async function getPublishedCatalogSkus() {
  const [base, publication, hasItemFields, hasGroupFields] = await Promise.all([
    itemBaseSql(), getCatalogPublicationSql(),
    availableCustomFields("Item", ["website_show_on_storefront"]),
    availableCustomFields("Item Group", ["website_show_on_storefront"])
  ]);
  const where = itemWhere({ categories: [], hasItemFields, hasGroupFields, productReadySql: publication.productReady });
  const params = { ...baseParams(), ...where.params };
  EXCLUDED_STOREFRONT_GROUPS.forEach((group, index) => { params[`excludedGroup${index}`] = group; });
  const [rows] = await getErpPool().execute(`SELECT DISTINCT i.name ${base} WHERE ${where.sql} ORDER BY i.name`, params);
  return rows.map((row) => row.name);
}

function normalizeQualityRows(rows, key) {
  return rows.map((row) => ({
    [key]: row[key] || "Unassigned",
    total: Number(row.total || 0),
    ready: Number(row.ready || 0),
    missingImage: Number(row.missing_image || 0),
    missingPrice: Number(row.missing_price || 0),
    incompleteDescription: Number(row.incomplete_description || 0)
  }));
}

export async function getCatalogQualityReport() {
  const publication = await getCatalogPublicationSql();
  const base = await catalogQualityBaseSql();
  const params = storePriceParams();
  const where = `
    IFNULL(i.disabled, 0) = 0
    AND IFNULL(i.is_sales_item, 1) = 1
    AND IFNULL(i.has_variants, 0) = 0
  `;
  const readyCountSql = `SUM(CASE WHEN ${publication.productReady} THEN 1 ELSE 0 END)`;
  const qualityColumns = `
    COUNT(*) AS total,
    ${readyCountSql} AS ready,
    SUM(CASE WHEN IFNULL(${publication.imageValue}, '') = '' THEN 1 ELSE 0 END) AS missing_image,
    SUM(CASE WHEN IFNULL(price.price_list_rate, 0) <= 0 THEN 1 ELSE 0 END) AS missing_price,
    SUM(CASE WHEN NOT (${publication.descriptionReady}) THEN 1 ELSE 0 END) AS incomplete_description
  `;
  const pool = getErpPool();
  const [[summaryRows], [groupRows], [brandRows]] = await Promise.all([
    pool.execute(`SELECT 'All products' AS scope, ${qualityColumns} ${base} WHERE ${where}`, params),
    pool.execute(
      `
        SELECT COALESCE(NULLIF(i.item_group, ''), 'Unassigned') AS item_group, ${qualityColumns}
        ${base}
        WHERE ${where}
        GROUP BY COALESCE(NULLIF(i.item_group, ''), 'Unassigned')
        ORDER BY (COUNT(*) - ${readyCountSql}) DESC, COUNT(*) DESC
      `,
      params
    ),
    pool.execute(
      `
        SELECT COALESCE(NULLIF(i.brand, ''), 'Unassigned') AS brand, ${qualityColumns}
        ${base}
        WHERE ${where}
        GROUP BY COALESCE(NULLIF(i.brand, ''), 'Unassigned')
        ORDER BY (COUNT(*) - ${readyCountSql}) DESC, COUNT(*) DESC
      `,
      params
    )
  ]);

  return {
    generatedAt: new Date().toISOString(),
    publicationRule: "Image, positive Standard Selling price, and a non-placeholder description of at least 24 characters",
    summary: normalizeQualityRows(summaryRows, "scope")[0],
    byItemGroup: normalizeQualityRows(groupRows, "item_group"),
    byBrand: normalizeQualityRows(brandRows, "brand")
  };
}

export const getCatalogDiagnostics = cachePublicRead(loadCatalogDiagnostics, 60_000);

async function loadCatalogDiagnostics() {
  const publication = await getCatalogPublicationSql();
  const [rows] = await getErpPool().execute(
    `
      SELECT
        COUNT(*) AS total_items,
        SUM(CASE WHEN IFNULL(i.disabled, 0) = 0 THEN 1 ELSE 0 END) enabled_items,
        SUM(CASE WHEN IFNULL(${publication.imageValue}, '') = '' THEN 1 ELSE 0 END) without_image,
        SUM(CASE WHEN IFNULL(i.item_group, '') IN ('', 'All Item Groups') THEN 1 ELSE 0 END) weak_group,
        SUM(CASE WHEN IFNULL(price.price_list_rate, 0) <= 0 THEN 1 ELSE 0 END) without_selling_price,
        SUM(CASE WHEN IFNULL(i.disabled, 0) = 0 AND ${publication.productReady} THEN 1 ELSE 0 END) publication_ready,
        SUM(CASE WHEN NOT (${publication.descriptionReady}) THEN 1 ELSE 0 END) incomplete_description
      ${await catalogQualityBaseSql()}
      WHERE IFNULL(i.is_sales_item, 1) = 1
        AND IFNULL(i.has_variants, 0) = 0
    `,
    storePriceParams()
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
    storefrontRules: {
      excludedGroups: EXCLUDED_STOREFRONT_GROUPS,
      excludedWarehouses: EXCLUDED_WAREHOUSES,
      source: "ERPNext Item Group website fields when present"
    },
    totals: rows[0],
    topGroups: groups
  };
}

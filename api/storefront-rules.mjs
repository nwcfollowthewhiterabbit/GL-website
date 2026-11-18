import { cachePublicRead } from "./public-read-cache.mjs";
import { getErpPool, availableCustomFields } from "./erpnext-db.mjs";
import { EXCLUDED_STOREFRONT_GROUPS, getCatalogPublicationSql } from "./catalog-publication-rules.mjs";

export { hasCustomField, availableCustomFields } from "./erpnext-db.mjs";
import { publicPriceSummarySql, storePriceParams } from "./selling-units.mjs";

export const CATEGORY_RULE_FIELDS = [
  "website_show_on_storefront",
  "website_sort_order",
  "website_stock_display",
  "website_show_products_without_images",
  "website_category_note"
];

export const ITEM_RULE_FIELDS = [
  "website_show_on_storefront",
  "website_featured",
  "website_price_mode_override",
  "website_stock_display_override",
  "website_sort_order"
];

export async function getCategoryRule(category) {
  const fields = await availableCustomFields("Item Group", CATEGORY_RULE_FIELDS);
  const selected = Object.keys(fields);
  if (!category || !selected.length) return defaultCategoryRule(category);

  const [rows] = await getErpPool().execute(
    `
      SELECT name, ${selected.map((field) => `\`${field}\``).join(", ")}
      FROM \`tabItem Group\`
      WHERE name = :category
      LIMIT 1
    `,
    { category }
  );

  return normalizeCategoryRule(rows[0] || { name: category });
}

export const getCategoryRules = cachePublicRead(loadCategoryRules, 60_000);

async function loadCategoryRules() {
  const publication = await getCatalogPublicationSql();
  const fields = await availableCustomFields("Item Group", CATEGORY_RULE_FIELDS);
  const selected = Object.keys(fields);
  const exclusions = Object.fromEntries(EXCLUDED_STOREFRONT_GROUPS.map((name, index) => [`group${index}`, name]));
  const itemFields = await availableCustomFields("Item", ["website_show_on_storefront"]);
  const selectFields = selected.length ? `, ${selected.map((field) => `ig.\`${field}\``).join(", ")}` : "";

  const [rows] = await getErpPool().execute(
    `
      SELECT ig.name, ig.parent_item_group AS parent, ig.is_group, ${fields.website_show_on_storefront ? "IF(IFNULL(ig.website_show_on_storefront, 1) = 1, COALESCE(SUM(i.offer_count), 0), 0)" : "COALESCE(SUM(i.offer_count), 0)"} AS item_count${selectFields}
      FROM \`tabItem Group\` ig
      LEFT JOIN (
        SELECT i.name, i.item_group, price.offer_count
        FROM \`tabItem\` i
        JOIN (${await publicPriceSummarySql()}) price ON price.item_code = i.name
        WHERE IFNULL(i.disabled, 0) = 0
          AND IFNULL(i.is_sales_item, 1) = 1
          AND IFNULL(i.has_variants, 0) = 0
          AND IFNULL(i.item_group, '') NOT IN (${Object.keys(exclusions).map(key => ":" + key).join(", ")})
          ${itemFields.website_show_on_storefront ? "AND IFNULL(i.website_show_on_storefront, 1) = 1" : ""}
          AND ${publication.productReady}
      ) i ON i.item_group = ig.name
      GROUP BY ig.name, ig.parent_item_group, ig.is_group, ig.lft${selected.map((field) => `, ig.\`${field}\``).join("")}
      ORDER BY ${fields.website_sort_order ? "IFNULL(ig.website_sort_order, 0)," : ""} ig.lft
    `
  , { ...storePriceParams(), ...exclusions });

  return rows.map(normalizeCategoryRule);
}

export function defaultCategoryRule(category = "") {
  return {
    name: category,
    parent: null,
    isGroup: false,
    itemCount: 0,
    showOnStorefront: true,
    sortOrder: 0,
    stockDisplay: "Availability",
    showProductsWithoutImages: true,
    categoryNote: ""
  };
}

function categoryBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return Boolean(Number(value));
}

export function normalizeCategoryRule(row = {}) {
  return {
    name: row.name,
    parent: row.parent || null,
    isGroup: Boolean(row.is_group),
    itemCount: Number(row.item_count || 0),
    showOnStorefront: categoryBoolean(row.website_show_on_storefront, true),
    sortOrder: Number(row.website_sort_order || 0),
    stockDisplay: row.website_stock_display || "Availability",
    showProductsWithoutImages: categoryBoolean(row.website_show_products_without_images, true),
    categoryNote: row.website_category_note || ""
  };
}

import { getErpPool } from "./erpnext-db.mjs";

const fieldCache = new Map();

export const CATEGORY_RULE_FIELDS = [
  "website_show_on_storefront",
  "website_sort_order",
  "website_price_mode",
  "website_price_list",
  "website_stock_display",
  "website_show_products_without_images",
  "website_show_products_without_price",
  "website_category_note"
];

export const ITEM_RULE_FIELDS = [
  "website_show_on_storefront",
  "website_featured",
  "website_price_mode_override",
  "website_stock_display_override",
  "website_sort_order"
];

export async function hasCustomField(dt, fieldname) {
  const key = `${dt}.${fieldname}`;
  if (fieldCache.has(key)) return fieldCache.get(key);

  const [rows] = await getErpPool().execute(
    "SELECT name FROM `tabCustom Field` WHERE dt = :dt AND fieldname = :fieldname LIMIT 1",
    { dt, fieldname }
  );
  const exists = Boolean(rows[0]);
  fieldCache.set(key, exists);
  return exists;
}

export async function availableCustomFields(dt, fieldnames) {
  const entries = await Promise.all(fieldnames.map(async (fieldname) => [fieldname, await hasCustomField(dt, fieldname)]));
  return Object.fromEntries(entries.filter(([, exists]) => exists).map(([fieldname]) => [fieldname, true]));
}

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

export async function getCategoryRules() {
  const fields = await availableCustomFields("Item Group", CATEGORY_RULE_FIELDS);
  const selected = Object.keys(fields);
  const selectFields = selected.length ? `, ${selected.map((field) => `ig.\`${field}\``).join(", ")}` : "";

  const [rows] = await getErpPool().execute(
    `
      SELECT ig.name, ig.parent_item_group AS parent, ig.is_group, COUNT(i.name) AS item_count${selectFields}
      FROM \`tabItem Group\` ig
      LEFT JOIN \`tabItem\` i
        ON i.item_group = ig.name
       AND IFNULL(i.disabled, 0) = 0
       AND IFNULL(i.is_sales_item, 1) = 1
      GROUP BY ig.name, ig.parent_item_group, ig.is_group, ig.lft${selected.map((field) => `, ig.\`${field}\``).join("")}
      ORDER BY ${fields.website_sort_order ? "IFNULL(ig.website_sort_order, 0)," : ""} ig.lft
    `
  );

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
    priceMode: "Price List",
    priceList: "",
    stockDisplay: "Availability",
    showProductsWithoutImages: true,
    showProductsWithoutPrice: false,
    categoryNote: ""
  };
}

export function normalizeCategoryRule(row = {}) {
  return {
    name: row.name,
    parent: row.parent || null,
    isGroup: Boolean(row.is_group),
    itemCount: Number(row.item_count || 0),
    showOnStorefront: row.website_show_on_storefront === undefined ? true : Boolean(Number(row.website_show_on_storefront)),
    sortOrder: Number(row.website_sort_order || 0),
    priceMode: row.website_price_mode || "Price List",
    priceList: row.website_price_list || "",
    stockDisplay: row.website_stock_display || "Availability",
    showProductsWithoutImages:
      row.website_show_products_without_images === undefined ? true : Boolean(Number(row.website_show_products_without_images)),
    showProductsWithoutPrice:
      row.website_show_products_without_price === undefined ? false : Boolean(Number(row.website_show_products_without_price)),
    categoryNote: row.website_category_note || ""
  };
}

import { reviewedDescriptionSql, reviewedImageSql } from "./catalog-verified-content.mjs";
import { getErpPool } from "./erpnext-db.mjs";

export const EXCLUDED_STOREFRONT_GROUPS = [
  "Expences",
  "Freight",
  "Fuel",
  "Labor",
  "Office Expences",
  "Raw Material",
  "Sub Assemblies",
  "TAXES",
  "Utility",
  "All Item Groups",
  "Products",
  "Construction project activities"
];

let publicationSql;

export async function getCatalogPublicationSql() {
  if (publicationSql) return publicationSql;

  const [rows] = await getErpPool().execute(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tabItem'
        AND COLUMN_NAME IN ('description', 'web_long_description', 'thumbnail', 'woocommerce_description')
    `
  );
  const columns = new Set(rows.map((row) => row.COLUMN_NAME));
  const primaryDescription = columns.has("web_long_description")
    ? "COALESCE(NULLIF(i.web_long_description, ''), NULLIF(i.description, ''), '')"
    : "COALESCE(NULLIF(i.description, ''), '')";
  const descriptionValue = columns.has("woocommerce_description") ? reviewedDescriptionSql(primaryDescription) : primaryDescription;
  const imageValue = columns.has("thumbnail") ? reviewedImageSql("i") : "i.image";
  const priceImageValue = columns.has("thumbnail") ? reviewedImageSql("item") : "item.image";
  const cleanDescription = `
    TRIM(
      REGEXP_REPLACE(
        ${descriptionValue},
        '<[^>]*>',
        ' '
      )
    )
  `;
  const descriptionReady = `
    ${cleanDescription} <> ''
    AND CHAR_LENGTH(${cleanDescription}) >= 24
    AND LOWER(${cleanDescription}) <> LOWER(TRIM(COALESCE(NULLIF(i.item_name, ''), i.name)))
  `;

  publicationSql = {
    imageValue,
    priceImageValue,
    descriptionValue,
    descriptionReady,
    productReady: `
      IFNULL(${imageValue}, '') <> ''
      AND IFNULL(price.price_list_rate, 0) > 0
      AND ${descriptionReady}
    `
  };
  return publicationSql;
}

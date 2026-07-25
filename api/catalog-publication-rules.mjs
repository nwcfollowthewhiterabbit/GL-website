import { getErpPool } from "./erpnext-db.mjs";

let publicationSql;

export async function getCatalogPublicationSql() {
  if (publicationSql) return publicationSql;

  const [rows] = await getErpPool().execute(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tabItem'
        AND COLUMN_NAME IN ('description', 'web_long_description')
    `
  );
  const columns = new Set(rows.map((row) => row.COLUMN_NAME));
  const descriptionValue = columns.has("web_long_description")
    ? "COALESCE(NULLIF(i.web_long_description, ''), NULLIF(i.description, ''), '')"
    : "COALESCE(NULLIF(i.description, ''), '')";
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
    descriptionValue,
    descriptionReady,
    productReady: `
      IFNULL(i.image, '') <> ''
      AND IFNULL(price.price_list_rate, 0) > 0
      AND ${descriptionReady}
    `
  };
  return publicationSql;
}

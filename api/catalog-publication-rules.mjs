export const CLEAN_CATALOG_DESCRIPTION_SQL = `
  TRIM(
    REGEXP_REPLACE(
      COALESCE(NULLIF(i.web_long_description, ''), NULLIF(i.description, ''), ''),
      '<[^>]*>',
      ' '
    )
  )
`;

export const CATALOG_DESCRIPTION_READY_SQL = `
  ${CLEAN_CATALOG_DESCRIPTION_SQL} <> ''
  AND CHAR_LENGTH(${CLEAN_CATALOG_DESCRIPTION_SQL}) >= 24
  AND LOWER(${CLEAN_CATALOG_DESCRIPTION_SQL}) <> LOWER(TRIM(COALESCE(NULLIF(i.item_name, ''), i.name)))
`;

export const CATALOG_PRODUCT_READY_SQL = `
  IFNULL(i.image, '') <> ''
  AND IFNULL(price.price_list_rate, 0) > 0
  AND ${CATALOG_DESCRIPTION_READY_SQL}
`;

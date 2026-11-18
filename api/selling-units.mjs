import { getCatalogPublicationSql } from "./catalog-publication-rules.mjs";
import { hasCustomField } from "./erpnext-db.mjs";

export function erpLocalDate(now = new Date(), timeZone = process.env.ERP_TIME_ZONE || "Pacific/Fiji") {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const parts = Object.fromEntries(date.map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function storePriceParams() {
  return {
    priceList: process.env.DEFAULT_PRICE_LIST || "Standard Selling",
    currency: process.env.DEFAULT_CURRENCY || "FJD",
    priceDate: erpLocalDate()
  };
}

// These two exact Item records say one piece per case and have a matching
// submitted Stock Entry and Stock Ledger movement. A later Item UOM row
// takes precedence. A renamed product or a new template disables the fallback.
export const publicStockConversionSql = `CASE
  WHEN COALESCE(NULLIF(ip.uom, ''), item.stock_uom) = item.stock_uom THEN 1
  WHEN conv.parent IS NOT NULL THEN conv.conversion_factor
  WHEN ip.uom = 'Each' AND item.stock_uom = 'Case' AND item.sales_uom = 'Case'
    AND COALESCE(item.variant_of, '') = ''
    AND (
      (item.name = 'REW-LPC' AND HEX(TRIM(item.item_name)) = HEX('2Ltr Magimix Gelato Expert, Stainless Steel - 1/Case'))
      OR (item.name = 'WIN-WB-29S' AND HEX(TRIM(item.item_name)) = HEX('Pipe Style Wine Bucket Stand For Wb-4 & Wb-4hv - 1/Case'))
    ) THEN 1
  ELSE NULL END`;

// Public rates must identify a selling unit and a trusted ERP conversion to stock.
// Rank effective dates before edit times; equally current conflicting rates need ERP review.
export async function publicSellingUnitsSql({ exactSku = false, search = false, featured = false, requireImage = false, requireConversion = true } = {}) {
  const imageFilter = requireImage ? `AND IFNULL(${(await getCatalogPublicationSql()).priceImageValue}, '') <> ''` : "";
  const customPriceList = await hasCustomField("Item Group", "website_price_list");
  const priceList = customPriceList ? "COALESCE(NULLIF(g.website_price_list, ''), :priceList)" : ":priceList";
  const completeConversion = `COUNT(current_price.conversion_factor) = COUNT(*)
      AND MIN(current_price.conversion_factor) = MAX(current_price.conversion_factor)
      AND MIN(current_price.conversion_factor) > 0`;
  const conversionCheck = exactSku === true && requireConversion === false
    ? `(COUNT(current_price.conversion_factor) = 0 OR (${completeConversion}))`
    : completeConversion;
  return `
    SELECT current_price.item_code, current_price.uom, current_price.price_list,
           current_price.currency, MIN(current_price.packing_unit) AS packing_unit,
           MIN(current_price.price_list_rate) AS price_list_rate,
           MIN(current_price.conversion_factor) AS conversion_factor
    FROM (
      SELECT ip.item_code, COALESCE(NULLIF(ip.uom, ''), item.stock_uom) AS uom,
             ip.price_list, ip.currency, ip.price_list_rate, IFNULL(ip.packing_unit, 0) AS packing_unit,
             ${publicStockConversionSql} AS conversion_factor,
             DENSE_RANK() OVER (
               PARTITION BY ip.item_code, COALESCE(NULLIF(ip.uom, ''), item.stock_uom)
               ORDER BY ip.valid_from DESC, ip.modified DESC
             ) AS priority
      FROM \`tabItem Price\` ip
      JOIN \`tabItem\` item ON item.name = ip.item_code
      LEFT JOIN \`tabItem Group\` g ON g.name = item.item_group
      LEFT JOIN \`tabUOM Conversion Detail\` conv
        ON conv.parent = ip.item_code AND conv.parenttype = 'Item' AND conv.parentfield = 'uoms'
        AND conv.uom = ip.uom
      WHERE ip.price_list = ${priceList} AND ip.currency = :currency
        ${exactSku ? "AND ip.item_code = :exactSku" : ""}
        ${search ? "AND (item.name LIKE :q OR item.item_name LIKE :q OR item.item_group LIKE :q OR item.description LIKE :q)" : ""}
        ${featured ? "AND IFNULL(item.website_featured, 0) = 1" : ""}
        ${imageFilter}
        AND ip.docstatus = 0 AND ip.selling = 1
        AND IFNULL(ip.customer, '') = '' AND IFNULL(ip.supplier, '') = ''
        AND IFNULL(ip.batch_no, '') = ''
        AND (ip.valid_from IS NULL OR ip.valid_from <= :priceDate)
        AND (ip.valid_upto IS NULL OR ip.valid_upto >= :priceDate)
    ) current_price
    WHERE current_price.priority = 1
    GROUP BY current_price.item_code, current_price.uom, current_price.price_list, current_price.currency
    HAVING MIN(current_price.price_list_rate) = MAX(current_price.price_list_rate)
      AND MIN(current_price.price_list_rate) > 0
      AND MIN(current_price.packing_unit) = MAX(current_price.packing_unit)
      AND MAX(current_price.packing_unit) <= 1000
      AND ${conversionCheck}`;
}

export async function publicPriceSummarySql() {
  return `SELECT item_code, MAX(price_list_rate) AS price_list_rate, COUNT(*) AS offer_count
    FROM (${await publicSellingUnitsSql()}) offers GROUP BY item_code`;
}

export function sellingName(name, defaultUom, sellingUom) {
  // A few item names end in their default pack. Keep the original description
  // unless we can identify that exact suffix and the selected pack differs.
  if (!name || !defaultUom || !sellingUom || defaultUom === sellingUom) return name;
  const suffix = name.slice(-defaultUom.length);
  if (suffix.toLowerCase() !== defaultUom.toLowerCase()) return name;
  const prefix = name.slice(0, -suffix.length);
  return /[\s,(-]$/.test(prefix) ? prefix + sellingUom : name;
}

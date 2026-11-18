import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const records = JSON.parse(readFileSync(new URL("./reviewed-product-specs.json", import.meta.url), "utf8"));
const details = new Map();
for (const [sku, manufacturer, partNumber, material, digest, imageDigest] of records) {
  if (!/^[A-Z0-9-]+$/.test(sku) || !/^[a-f0-9]{64}$/.test(digest) || (imageDigest !== null && !/^[a-f0-9]{64}$/.test(imageDigest)) || details.has(sku)) {
    throw new Error("Invalid reviewed product specification");
  }
  details.set(sku, { manufacturer, partNumber, material, digest, imageDigest });
}

// A previous public material attribute also appears as a complete material in the
// ERP name. Bind the exact ERP name, manufacturer, part, stock unit and image to
// the review, and prefer an edited primary description as soon as ERP supplies one.
export function reviewedSpecSql(columns) {
  const required = ["manufacturer", "manufacturer_part_no", "stock_uom", "image"];
  const approved = records.filter(([, , , , , imageDigest]) => imageDigest);
  if (!approved.length || required.some(field => !columns.has(field))) return "FALSE";
  const skus = approved.map(([sku]) => `'${sku}'`).join(",");
  const hashes = approved.map(([, , , , digest]) => `'${digest}'`).join(",");
  return `(i.name IN (${skus}) AND SHA2(CONCAT_WS(CHAR(31),
    i.name, i.item_name, i.manufacturer, i.manufacturer_part_no, i.stock_uom, i.image
  ), 256) IN (${hashes}))`;
}

export function reviewedProductDescription(sku) {
  const spec = details.get(sku);
  if (!spec) return "";
  return `Made from ${spec.material.toLowerCase()} by ${spec.manufacturer}. Manufacturer part number ${spec.partNumber}.`;
}

export function reviewedProductImage(sku) {
  const spec = details.get(sku);
  return spec?.imageDigest ? "/catalog-reviewed/" + sku + ".webp?v=" + spec.imageDigest.slice(0, 12) : null;
}

export function reviewedEnquiryDescription(row) {
  const spec = details.get(row.sku);
  if (!spec) return "";
  const fields = [row.sku, row.name, row.manufacturer, row.manufacturer_part_no, row.stock_uom, row.image];
  const digest = createHash("sha256").update(fields.join(String.fromCharCode(31))).digest("hex");
  return digest === spec.digest ? reviewedProductDescription(row.sku) : "";
}

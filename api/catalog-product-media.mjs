import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const rows = JSON.parse(readFileSync(new URL("./reviewed-product-media.json", import.meta.url), "utf8"));
const photos = new Map(rows.map(([sku, identity, path]) => [sku, { identity, path }]));
const legacyStoreOrigin = /^(?:https?:)?\/\/(?:www\.)?greenleafpacific\.com(?:[/:?#]|$)/i;

export function catalogProductImage(sku, name, source) {
  if (!source) return null;
  const photo = photos.get(sku);
  if (photo) {
    // An ERP rename or a changed image invalidates the reviewed association.
    const identity = createHash("sha256").update(JSON.stringify([sku, name, source])).digest("hex");
    if (identity === photo.identity) return photo.path;
  }
  if (source.startsWith("/private/") || legacyStoreOrigin.test(source)) return null;
  return source;
}

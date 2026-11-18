import assert from "node:assert/strict";
import { legacyDestination } from "../api/public-navigation.mjs";
for (const [url, destination] of [
  ["/foodservice/", "/catalog/kitchen-equipment"], ["/contact-us/", "/contact"],
  ["/my-account/", "/account"], ["/order-history/", "/previous-orders"],
  ["/furniture--outdoor/wooden-furniture/buffet/napkin-holder-2", "/products/ART-NH"],
  ["/index.php?route=product/product&path=132_133_685&product_id=106098", "/products/ART-2C-WP"],
  ["/index.php?route=product/category&path=59_65", "/catalog/front-of-house"],
  ["/index.php?route=product/manufacturer/info&manufacturer_id=12", "/catalog?q=Vicrila"],
  ["/unrelated/napkin-holder-2", null], ["/index.php?route=product/product&product_id=0", null]
]) {
  const parsed = new URL(url, "https://example.test");
  assert.equal(legacyDestination(parsed.pathname, parsed.searchParams), destination, url);
}
console.log("Ten legacy route cases passed.");

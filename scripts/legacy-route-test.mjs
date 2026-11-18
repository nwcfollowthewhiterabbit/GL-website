import assert from "node:assert/strict";
import express from "express";
import { displayItemName } from "../api/catalog-verified-content.mjs";
import { readFileSync } from "node:fs";
import { reviewedProductDescription, reviewedSpecSql } from "../api/reviewed-product-specs.mjs";
import { findCatalogReference, findPreviousOffer, installPublicNavigation, legacyDestination } from "../api/public-navigation.mjs";
for (const [url, destination] of [
  ["/foodservice/", "/catalog/kitchen-equipment"], ["/contact-us/", "/contact"],
  ["/my-account/", "/account"], ["/order-history/", "/previous-orders"],
  ["/furniture--outdoor/wooden-furniture/buffet/napkin-holder-2", "/products/ART-NH"],
  ["/index.php?route=product/product&path=132_133_685&product_id=106098", "/products/ART-2C-WP"],
  ["/index.php?route=product/category&path=59_65", "/catalog/front-of-house"],
  ["/index.php?route=product/manufacturer/info&manufacturer_id=12", "/catalog?q=Vicrila"],
  ["/index.php?route=product/product&product_id=106281", "/products/ALT-AT-ST49FGA"],
  ["/index.php?route=product/product&product_id=107821", "/products/ONT-50BP-SUNDRIED"],
  ["/index.php?route=product/product&product_id=107822", "/products/ONT-55BP-Aged-Green"],
  ["/index.php?route=product/product&product_id=107824", "/products/ONT-55BP-SUNDRIED"],
  ["/m-series-gas-convection-oven", "/previous-products/106525"],
  ["/index.php?route=product/product&product_id=105069", "/previous-products/105069"],
  ["/amenity-tray---five-star", "/previous-products/66449"],
  ["/index.php?route=product/product&product_id=106100", "/previous-products/106100"],
  ["/unrelated/napkin-holder-2", null], ["/index.php?route=product/product&product_id=0", null]
]) {
  const parsed = new URL(url, "https://example.test");
  assert.equal(legacyDestination(parsed.pathname, parsed.searchParams), destination, url);
}
assert.equal(displayItemName("WIN-TMT-P2", "-40 To 82Â°C"), "-40 To 82°C");
assert.equal(displayItemName("WIN-TN43", '3.5"Â\u00a0Blade'), '3.5" Blade');
const oldCase = { target: "SAMPLE", targetUom: "48/Case" };
const pack = units => async (_, uom) => units.find(row => row.uom === uom);
assert.equal(await findPreviousOffer(oldCase, pack([{ sku: "SAMPLE", uom: "Each", name: "Pan - 48/Case" }])), null);
assert.equal(await findPreviousOffer(oldCase, pack([{ sku: "SAMPLE", uom: "Case", name: "Pan - 148/Case" }])), null);
assert.equal((await findPreviousOffer(oldCase, pack([{ sku: "SAMPLE", uom: "Case", name: "Pan - 48/Case" }]))).uom, "Case");
assert.equal((await findPreviousOffer(oldCase, pack([{ sku: "SAMPLE", uom: "48/Case" }]))).uom, "48/Case");
const specs = JSON.parse(readFileSync(new URL("../api/reviewed-product-specs.json", import.meta.url), "utf8"));
assert.equal(reviewedSpecSql(new Set(["image"])), "FALSE");
for (const [sku, , part, material] of specs) {
  assert.ok(reviewedProductDescription(sku).includes(part));
  assert.ok(reviewedProductDescription(sku).includes(material.toLowerCase()));
}
const app = express();
const loadItem = async (sku, options = {}) => {
  assert.equal(sku, "REW-3445745");
  return { sku, name: "Plate, round", ...(options.withPrice ? { price: { amount: 36.68, currency: "FJD", uom: "125/Case" } } : {}) };
};
assert.equal((await findCatalogReference(" rew-3445745 ", loadItem))?.sku, "REW-3445745");
assert.equal(await findCatalogReference("INTERNAL-UNKNOWN", () => assert.fail("private SKU lookup")), null);
installPublicNavigation(app, async () => [], async () => [], async () => null, loadItem);
const server = app.listen(0, "127.0.0.1");
try {
  await new Promise(resolve => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const contact = await fetch(base + "/products/REW-3445745");
  const contactText = await contact.text();
  assert.equal(contact.status, 200);
  assert.match(contactText, /FJD 36.68 per 125\/Case/);
  assert.match(contactText, /Contact sales to confirm availability/);
  assert.doesNotMatch(contactText, /add to basket/i);
  const archive = await fetch(base + "/previous-products/105069");
  const archiveText = await archive.text();
  assert.match(archiveText, /Oval Cascading Bowl/);
  assert.match(archiveText, /Previous catalog reference GL-105069/);
  assert.match(archiveText, /subject=Availability%20of%20GL-105069/);
  assert.equal((await fetch(base + "/previous-products/0")).status, 404);
  const choices = await fetch(base + "/products/FOW-A11");
  const choiceText = await choices.text();
  assert.match(choiceText, /previous-products\/66449/);
  assert.match(choiceText, /previous-products\/106100/);
} finally {
  await new Promise(resolve => server.close(resolve));
}
console.log("Legacy routes and enquiry pages passed.");

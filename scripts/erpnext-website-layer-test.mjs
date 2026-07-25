import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { websiteMigrationIds } from "../api/migrations/runner.mjs";

const erpnextRoot = fileURLToPath(new URL("../erpnext/", import.meta.url));
const manifestPath = fileURLToPath(new URL("../erpnext/website-layer.json", import.meta.url));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

assert.equal(manifest.schemaVersion, 1);
assert.deepEqual(websiteMigrationIds(), [
  "001-website-customer-credentials",
  "002-website-payment-event"
]);

const fixtureDocTypes = new Set();
const customFieldTargets = new Set();

for (const relativePath of manifest.fixtureFiles) {
  const fixtures = JSON.parse(await readFile(`${erpnextRoot}${relativePath}`, "utf8"));
  assert.ok(Array.isArray(fixtures) && fixtures.length > 0, `${relativePath} must contain fixtures`);

  for (const fixture of fixtures) {
    if (fixture.doctype === "Custom Field") {
      customFieldTargets.add(fixture.dt);
    } else if (fixture.doctype === "DocType") {
      assert.equal(fixture.custom, 1, `${fixture.name} must remain a custom DocType`);
      fixtureDocTypes.add(fixture.name);
    }
  }
}

assert.deepEqual(
  [...fixtureDocTypes].sort(),
  [...manifest.websiteDocTypes].sort(),
  "manifest websiteDocTypes must match DocType fixtures"
);
assert.deepEqual(
  [...customFieldTargets].sort(),
  [...manifest.customFieldTargets].sort(),
  "manifest customFieldTargets must match Custom Field fixtures"
);

for (const relativePath of manifest.pageFiles) {
  await access(`${erpnextRoot}${relativePath}`);
}

const excluded = new Set(manifest.excludedApps);
assert.ok(excluded.has("woocommerceconnector"));
assert.ok(!manifest.supportedTargets.some((target) => excluded.has(target)));

console.log("ERPNext website layer contract passed.");

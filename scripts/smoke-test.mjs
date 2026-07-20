const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:8080").replace(/\/+$/, "");

async function readJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${text.slice(0, 240)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${path} did not return JSON: ${text.slice(0, 240)}`);
  }
}

async function readText(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${text.slice(0, 240)}`);
  }

  return text;
}

async function expectStatus(path, expectedStatuses, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const expected = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
  if (!expected.includes(response.status)) {
    const text = await response.text();
    throw new Error(`${path} returned ${response.status}, expected ${expected.join("/")}: ${text.slice(0, 240)}`);
  }
  return response;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const health = await readJson("/health");
  assert(health.ok, "Health endpoint is not ok");
  assert(!("erpnextConfigured" in health), "Public health endpoint exposes configuration state");

  const catalog = await readJson("/api/catalog/products?page=1&pageSize=2&q=Bath");
  assert(Array.isArray(catalog.products), "Catalog products response is invalid");
  assert(catalog.products.length > 0, "Catalog search returned no products");
  assert(catalog.priceList === "Standard Selling", "Unexpected catalog price list");


  const departments = await readJson("/api/storefront/departments");
  assert(Array.isArray(departments.departments), "Website departments response is invalid");
  assert(typeof departments.source === "string", "Website departments source is missing");

  const banners = await readJson("/api/storefront/banners");
  assert(Array.isArray(banners.banners), "Website banners response is invalid");
  assert(typeof banners.source === "string", "Website banners source is missing");

  const websiteCatalogs = await readJson("/api/storefront/catalogs");
  assert(Array.isArray(websiteCatalogs.catalogs), "Website catalogs response is invalid");
  assert(websiteCatalogs.catalogs.length > 0, "Website catalogs returned no downloads");
  assert(typeof websiteCatalogs.source === "string", "Website catalogs source is missing");

  const websiteManufacturers = await readJson("/api/storefront/manufacturers");
  assert(Array.isArray(websiteManufacturers.manufacturers), "Website manufacturers response is invalid");
  const customerCorner = await readJson("/api/storefront/customer-corner");
  assert(customerCorner.settings?.title, "Customer corner settings response is invalid");
  assert(customerCorner.settings.loginEnabled === false, "Production account login should be disabled without an email provider");
  assert(websiteManufacturers.manufacturers.length > 0, "Website manufacturers returned no logos");
  assert(typeof websiteManufacturers.source === "string", "Website manufacturers source is missing");

  const product = await readJson(`/api/catalog/product?sku=${encodeURIComponent(catalog.products[0].sku)}`);
  assert(product.product?.sku === catalog.products[0].sku, "Product endpoint returned the wrong SKU");

  const related = await readJson(`/api/catalog/related?sku=${encodeURIComponent(catalog.products[0].sku)}&limit=4`);
  assert(Array.isArray(related.products), "Related products response is invalid");

  const featured = await readJson("/api/catalog/featured?limit=4");
  assert(Array.isArray(featured.products), "Featured products response is invalid");
  assert(featured.products.length > 0, "Featured products returned no products");

  const productPage = await readText(`/products/${encodeURIComponent(catalog.products[0].sku)}`);
  assert(productPage.includes('<div id="root"></div>'), "Product route did not return the SPA shell");

  const categoryPage = await readText("/catalog/karcher-au");
  assert(categoryPage.includes('<div id="root"></div>'), "Category route did not return the SPA shell");

  const accountPage = await readText("/account");
  assert(accountPage.includes('<div id="root"></div>'), "Account route did not return the SPA shell");

  const diagnostics = await readJson("/api/catalog/diagnostics");
  assert(diagnostics.storefrontRules?.defaultCurrency === "FJD", "Public catalog diagnostics are invalid");

  for (const policyPath of ["/privacy", "/terms", "/shipping", "/returns", "/payment-security"]) {
    const policyPage = await readText(policyPath);
    assert(policyPage.includes('<div id="root"></div>'), `${policyPath} did not return the SPA shell`);
  }

  const robots = await readText("/robots.txt");
  assert(robots.includes("Disallow: /"), "Testing robots policy is missing");
  const sitemap = await readText("/sitemap.xml");
  assert(sitemap.includes("/payment-security"), "Policy sitemap is incomplete");

  await expectStatus("/api/account/quotes?email=patch.fields%40example.com", 401);
  const loginResponse = await expectStatus("/api/account/login/start", 503, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "patch.fields@example.com" })
  });
  const loginResult = await loginResponse.json();
  assert(loginResult.error === "account_login_unavailable" && !loginResult.devCode, "Production login exposed a development code");
  await expectStatus("/api/admin/recent-quotes?limit=2", [401, 404]);
  await expectStatus("/api/admin/customer-access?limit=2", [401, 404]);
  await expectStatus("/api/sync/status", [401, 404]);

  const hostileCorsResponse = await fetch(`${baseUrl}/api/catalog/summary`, {
    headers: { Origin: "https://invalid-origin.example" }
  });
  assert(!hostileCorsResponse.headers.get("access-control-allow-origin"), "Untrusted CORS origin was allowed");

  const pageResponse = await fetch(`${baseUrl}/catalog`);
  for (const header of ["content-security-policy", "strict-transport-security", "x-content-type-options", "x-frame-options"]) {
    assert(pageResponse.headers.get(header), `Missing security header: ${header}`);
  }

  console.log("Smoke checks passed");
  console.log(`- Catalog search products: ${catalog.products.length} of ${catalog.total}`);
  console.log(`- Website departments source: ${departments.source}`);
  console.log(`- Website banners source: ${banners.source}`);
  console.log(`- Website catalogs source: ${websiteCatalogs.source}, ${websiteCatalogs.catalogs.length} downloads`);
  console.log(`- Website manufacturers source: ${websiteManufacturers.source}, ${websiteManufacturers.manufacturers.length} logos`);
  console.log(`- Customer corner source: ${customerCorner.source}`);
  console.log(`- Product route SKU: ${product.product.sku}`);
  console.log(`- Related products: ${related.products.length}`);
  console.log(`- Featured products: ${featured.products.length} from ${featured.source}`);
  console.log("- Category route shell: ok");
  console.log("- Policy routes and static compliance files: ok");
  console.log("- Account, admin and sync route protection: ok");
  console.log("- CORS and security headers: ok");
}

main().catch((error) => {
  console.error(`Smoke checks failed: ${error.message}`);
  process.exitCode = 1;
});

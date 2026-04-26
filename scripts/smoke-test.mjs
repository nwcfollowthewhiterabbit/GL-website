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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const health = await readJson("/health");
  assert(health.ok, "Health endpoint is not ok");
  assert(health.erpnextConfigured, "ERPNext REST credentials are not configured");
  assert(health.erpnextDbReachable, "ERPNext database is not reachable");

  const catalog = await readJson("/api/catalog/products?page=1&pageSize=2&q=Bath");
  assert(Array.isArray(catalog.products), "Catalog products response is invalid");
  assert(catalog.products.length > 0, "Catalog search returned no products");
  assert(catalog.priceList === "Standard Selling", "Unexpected catalog price list");

  const facets = await readJson("/api/catalog/facets");
  assert(Array.isArray(facets.itemGroups), "Catalog facets response is invalid");
  assert(facets.itemGroups.length > 0, "Catalog facets returned no item groups");

  const product = await readJson(`/api/catalog/product?sku=${encodeURIComponent(catalog.products[0].sku)}`);
  assert(product.product?.sku === catalog.products[0].sku, "Product endpoint returned the wrong SKU");

  const productPage = await readText(`/products/${encodeURIComponent(catalog.products[0].sku)}`);
  assert(productPage.includes('<div id="root"></div>'), "Product route did not return the SPA shell");

  const categoryPage = await readText("/catalog/karcher-au");
  assert(categoryPage.includes('<div id="root"></div>'), "Category route did not return the SPA shell");

  const quotes = await readJson("/api/admin/recent-quotes?limit=2");
  assert(Array.isArray(quotes.quotes), "Recent quotes response is invalid");

  console.log("Smoke checks passed");
  console.log(`- ERPNext DB reachable: ${health.erpnextDbReachable}`);
  console.log(`- Catalog search products: ${catalog.products.length} of ${catalog.total}`);
  console.log(`- Facet item groups: ${facets.itemGroups.length}`);
  console.log(`- Product route SKU: ${product.product.sku}`);
  console.log("- Category route shell: ok");
  console.log(`- Recent website quotations: ${quotes.quotes.length}`);
}

main().catch((error) => {
  console.error(`Smoke checks failed: ${error.message}`);
  process.exitCode = 1;
});

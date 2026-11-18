import { withoutEmbeddedPrices } from "./catalog-verified-content.mjs";
import { cachePublicRead } from "./public-read-cache.mjs";
import { readFileSync } from "node:fs";
import { getCatalogItemGroups } from "./catalog-service.mjs";
import { getWebsiteDepartments } from "./storefront-control-service.mjs";
import { sitemapXml } from "../scripts/site-profile.mjs";

const legacy = JSON.parse(readFileSync(new URL("./legacy-public-catalog.json", import.meta.url), "utf8"));
const uncoded = JSON.parse(readFileSync(new URL("./legacy-uncoded-products.json", import.meta.url), "utf8"));
const previouslyListed = JSON.parse(readFileSync(new URL("./previously-listed-skus.json", import.meta.url), "utf8"));
const enquiryCodes = new Map(previouslyListed.map(sku => [sku.toLowerCase(), sku]));
// These old codes were shared across products or packaging. Keep each historical page distinct.
const ambiguousCodes = new Set(["FOW-A11", "Tray", "WIN-KFP-123"]);
const conditionalTargets = new Map(JSON.parse(readFileSync(new URL("./legacy-sale-targets.json", import.meta.url), "utf8"))
  .map(([id, sku, uom]) => [id, { sku, uom }]));
const ids = new Map();
const aliases = new Map();
const previousProducts = new Map();
const ambiguousProducts = new Map();
const categoryAliases = new Set();
for (const [kind, rows] of Object.entries(legacy)) {
  for (const [id, value, keywords, title, currentSku] of rows) {
    const replacement = kind === "products" ? conditionalTargets.get(id) : null;
    const target = replacement?.sku;
    const archiveId = kind === "products" && !currentSku && (ambiguousCodes.has(value) || target) ? id : null;
    const record = { kind, value: currentSku || value, title, archiveId, target, targetUom: replacement?.uom };
    ids.set(kind + ":" + id, record);
    if (kind === "products") {
      if (!record.archiveId) {
        previousProducts.set(value, record);
        enquiryCodes.set(value.toLowerCase(), record.value);
        enquiryCodes.set(record.value.toLowerCase(), record.value);
      }
      if (ambiguousCodes.has(value)) {
        const entries = ambiguousProducts.get(value) || [];
        entries.push(record);
        ambiguousProducts.set(value, entries);
      }
      if (target) {
        enquiryCodes.set(target.toLowerCase(), target);
        if (!ambiguousCodes.has(value)) {
          previousProducts.set(value, record);
          enquiryCodes.set(value.toLowerCase(), target);
        }
      }
      if (currentSku) previousProducts.set(currentSku, record);
    }
    for (const keyword of keywords) {
      aliases.set(keyword.toLowerCase(), record);
      if (kind === "categories") categoryAliases.add(keyword.toLowerCase());
    }
  }
}

for (const [id, keywords, title] of uncoded) {
  const record = { kind: "products", archiveId: id, title };
  ids.set("products:" + id, record);
  for (const keyword of keywords) {
    if (!aliases.has(keyword.toLowerCase())) aliases.set(keyword.toLowerCase(), record);
  }
}

const previousPages = new Map(Object.entries({
  "/contact-us": "/contact", "/order-history": "/previous-orders", "/my-account": "/account",
  "/simpleregister": "/account", "/login": "/account", "/about_us": "/about-us",
  "/add-return": "/returns", "/sitemap": "/catalog", "/brands": "/catalog#brands"
}));
const previousActions = new Map(Object.entries({
  "account/account": "/account", "account/login": "/account", "account/register": "/account",
  "account/order": "/previous-orders", "account/forgotten": "/account",
  "information/contact": "/contact", "information/sitemap": "/catalog", "common/home": "/"
}));
function destination(record) {
  if (record.archiveId) return "/previous-products/" + record.archiveId;
  return record.kind === "products" ? "/products/" + encodeURIComponent(record.value) : record.value;
}

export async function findCatalogReference(query, loadVisibleItem) {
  if (typeof query !== "string") return null;
  const sku = enquiryCodes.get(query.trim().toLowerCase());
  if (!sku) return null;
  const item = await loadVisibleItem(sku);
  return item?.sku === sku ? item : null;
}

export function legacyDestination(path, query) {
  const key = path.toLowerCase().replace(/\/+$/, "");
  if (previousPages.has(key)) return previousPages.get(key);
  if (key === "/index.php") {
    const action = query.get("route");
    if (previousActions.has(action)) return previousActions.get(action);
    const routes = {
      "product/product": ["products", query.get("product_id")],
      "product/category": ["categories", query.get("path")?.split("_").at(-1)],
      "product/manufacturer/info": ["manufacturers", query.get("manufacturer_id")]
    };
    const pair = Object.hasOwn(routes, action) && routes[action];
    const record = pair && ids.get(pair.join(":"));
    return record ? destination(record) : null;
  }
  const parts = key.split("/").filter(Boolean);
  if (!parts.length || !parts.slice(0, -1).every(part => categoryAliases.has(part))) return null;
  const record = aliases.get(parts.at(-1));
  return record ? destination(record) : null;
}

export async function findPreviousOffer(record, loadProduct) {
  if (!loadProduct || !record.targetUom) return null;
  const offer = await loadProduct(record.target, record.targetUom);
  if (offer?.sku === record.target && offer.uom === record.targetUom) return offer;
  const caseCount = /^(\d+)\/Case$/.exec(record.targetUom);
  if (!caseCount) return null;
  const byCase = await loadProduct(record.target, "Case");
  if (byCase?.sku !== record.target || byCase.uom !== "Case") return null;
  const printedCount = /\b(\d+)\s*\/\s*case\s*$/i.exec(byCase.name);
  return printedCount?.[1] === caseCount[1] ? byCase : null;
}

function escapeHtml(text) {
  return String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function informationPage(res, status, title, description, { sku, account, uom, reference, choices = [], specifications } = {}) {
  const heading = withoutEmbeddedPrices(title) || sku || "Product information";
  const subject = [sku, reference].filter(Boolean).join(" / ");
  const mail = "mailto:buy@greenleafpacific.com" + (subject ? "?subject=" + encodeURIComponent("Availability of " + subject) : "");
  res.status(status).set("X-Robots-Tag", "noindex, follow").type("html").send(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex, follow"><link rel="stylesheet" href="/store-information.css">'
    + '<title>' + escapeHtml(heading) + ' | Green Leaf Pacific</title></head><body><header><a href="/"><img src="/legacy/greenleaf-logo.png" alt="">Green Leaf Pacific</a></header>'
    + '<main><h1>' + escapeHtml(heading) + '</h1>' + (sku ? '<p>SKU ' + escapeHtml(sku) + '</p>' : '')
    + (choices.length ? '<ul>' + choices.map(choice => '<li><a href="' + escapeHtml(destination(choice)) + '">' + escapeHtml(withoutEmbeddedPrices(choice.title) || choice.value) + '</a></li>').join('') + '</ul>' : '')
    + (reference ? '<p>Previous catalog reference ' + escapeHtml(reference) + '</p>' : '')
    + (specifications ? '<p>' + escapeHtml(withoutEmbeddedPrices(specifications)) + '</p>' : '')
    + (uom ? '<p>Packaging: ' + escapeHtml(uom) + '</p>' : '')
    + '<p>' + escapeHtml(withoutEmbeddedPrices(description)) + '</p><p><a href="' + escapeHtml(mail) + '">Email Green Leaf sales</a> · <a href="tel:+6796702222">+679 670 2222</a></p>'
    + '<p>4, Nippon Complex, Nadi Backroad, Nadi, Fiji</p><nav><a href="/catalog">Browse the current catalog</a>'
    + (account ? '<a href="/account">Open customer account</a>' : '') + '</nav></main></body></html>'
  );
}

export async function categoryPaths() {
  const [groups, { departments }] = await Promise.all([getCatalogItemGroups(), getWebsiteDepartments()]);
  const slug = name => name.toLowerCase().trim().replaceAll("&", "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const names = new Set(groups.filter(group => group.showOnStorefront && group.itemCount > 0).map(group => group.name));
  const paths = [...names].map(name => "/catalog/" + slug(name));
  for (const department of departments) {
    const path = "/catalog/" + department.id;
    paths.push(path, ...department.itemGroups.filter(name => names.has(name)).map(name => path + "/" + slug(name)));
  }
  return paths;
}

function cachedSet(load) {
  return cachePublicRead(async () => new Set(await load()), 300_000);
}

export function installPublicNavigation(app, loadPublishedSkus, loadCategoryPaths = categoryPaths, loadProduct, loadVisibleItem = async () => null) {
  const published = cachedSet(loadPublishedSkus);
  const categories = cachedSet(loadCategoryPaths);
  const isPublished = loadProduct
    ? async sku => (await loadProduct(sku))?.sku === sku
    : async sku => (await published()).has(sku);
  app.get(/^\/catalog\/.+/, async (req, res) => {
    try {
      if ((await categories()).has(req.path.replace(/\/+$/, ""))) return res.set("X-Accel-Redirect", "/__storefront_shell").end();
      return informationPage(res, 404, "Category not found", "Browse the catalog to see the current departments and product groups.");
    } catch {
      return res.status(503).set("Retry-After", "30").end();
    }
  });
  app.get("/sitemap.xml", async (req, res) => {
    // Nginx replaces this header with the validated build origin for the site it serves.
    const origin = req.get("X-Storefront-Origin") || process.env.STORE_PUBLIC_URL;
    try {
      const [items, groups] = await Promise.all([published(), categories()]);
      const urls = [...groups, ...[...items].map(sku => "/products/" + encodeURIComponent(sku))];
      res.set("Cache-Control", "public, max-age=300").type("application/xml")
        .send(sitemapXml({ publicSiteUrl: new URL(origin).origin }, urls));
    } catch {
      res.status(503).set("Retry-After", "30").end();
    }
  });
  app.get("/contact", (_req, res) => informationPage(res, 200, "Contact Green Leaf", "Contact our Nadi sales team for availability, quotations, delivery or help with an order."));
  app.get("/previous-orders", (_req, res) => informationPage(res, 200, "Orders from the previous website", "For an order placed on our previous website, contact sales with your order number and the email used to order. To track quotations placed on this website, sign in to your customer account.", { account: true }));
  app.get("/previous-products/:id", async (req, res) => {
    const record = ids.get("products:" + req.params.id);
    if (!record?.archiveId) return informationPage(res, 404, "Product not found", "Search the catalog or contact sales for help identifying this item.");
    if (record.target) {
      try {
        const offer = await findPreviousOffer(record, loadProduct);
        if (offer) return res.redirect(302, "/products/" + encodeURIComponent(offer.sku) + "?" + new URLSearchParams({ uom: offer.uom }));
        const item = await findCatalogReference(record.target, loadVisibleItem);
        if (item) return informationPage(res, 200, record.title, "Contact sales using the current item code " + item.sku + " to confirm packaging and availability.", { sku: record.value, reference: "GL-" + record.archiveId });
      } catch {
        return res.status(503).set("Retry-After", "30").end();
      }
    }
    return informationPage(res, 200, record.title, "This product appeared in our previous catalog. Contact sales for current availability and packaging.", { sku: record.value, reference: "GL-" + record.archiveId });
  });
  app.get("/products/:sku", async (req, res) => {
    const sku = req.params.sku;
    try {
      const canonical = enquiryCodes.get(sku.toLowerCase());
      if (canonical && canonical !== sku && canonical.toLowerCase() === sku.toLowerCase()) return res.redirect(301, "/products/" + encodeURIComponent(canonical));
      if (await isPublished(sku)) return res.set("X-Accel-Redirect", "/__storefront_shell").end();
      const record = previousProducts.get(sku);
      const choices = ambiguousProducts.get(sku);
      if (choices?.length) return informationPage(res, 200, "Previous catalog listings", "Select the product or packaging from the previous catalog.", { sku, choices });
      if (record?.target) return res.redirect(302, destination(record));
      if (record && record.value !== sku) return res.redirect(301, destination(record));
      const item = await findCatalogReference(sku, code => loadVisibleItem(code, { withDetails: true }));
      if (item) {
        const message = "Contact sales to confirm availability, packaging and the quantity for your quotation.";
        return informationPage(res, 200, item.name || item.sku, message, { sku: item.sku, uom: item.uom, specifications: item.description });
      }
      if (record) return informationPage(res, 200, record.title || sku, "This item appeared in our previous catalog. Contact sales with this item code for availability or a current alternative.", { sku });
      return informationPage(res, 404, "Product not found", "Search the catalog or contact our team for help identifying this item.");
    } catch {
      return res.status(503).set("Retry-After", "30").end();
    }
  });
  app.use((req, res, next) => {
    if (!["GET", "HEAD"].includes(req.method) || req.path.startsWith("/api/")) return next();
    const url = new URL(req.originalUrl, "http://localhost");
    let path;
    try { path = decodeURIComponent(url.pathname); } catch { return res.sendStatus(400); }
    const to = legacyDestination(path, url.searchParams);
    if (to) return res.redirect(301, to);
    return informationPage(res, 404, "Page not found", "Use the current catalog or contact Green Leaf to find the page you need.");
  });
}

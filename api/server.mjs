import cors from "cors";
import "dotenv/config";
import express from "express";
import {
  getCatalogDiagnostics,
  getCatalogItemGroups,
  getCatalogProductBySku,
  getCatalogProducts,
  getFeaturedCatalogProducts
} from "./catalog-service.mjs";
import { pingErpDb } from "./erpnext-db.mjs";
import { legacySyncRules } from "./legacy-sync-rules.mjs";
import { createQuoteRequest, getRecentWebsiteQuotes, getWebsiteQuotesByEmail } from "./quote-service.mjs";
import { getWebsiteBanners, getWebsiteDepartments } from "./storefront-control-service.mjs";
import {
  endAccountSession,
  getAccountSession,
  getCustomerOrdersByEmail,
  getCustomerProfileByEmail,
  startAccountLogin,
  verifyAccountLogin
} from "./account-service.mjs";
import { catalogStats, categories, featuredProducts, manufacturers } from "../src/data/catalog.mjs";

const app = express();
const port = Number(process.env.API_PORT || 3000);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", async (_req, res) => {
  let erpnextDbReachable = false;
  try {
    erpnextDbReachable = await pingErpDb();
  } catch {
    erpnextDbReachable = false;
  }

  res.json({
    ok: true,
    service: "green-leaf-integration-api",
    erpnextConfigured: Boolean(process.env.ERPNEXT_API_KEY && process.env.ERPNEXT_API_SECRET),
    erpnextDbReachable
  });
});

app.get("/api/catalog/summary", (_req, res) => {
  res.json({
    stats: catalogStats,
    categories,
    manufacturers,
    featuredProducts
  });
});

app.get("/api/catalog/search", (req, res) => {
  const query = String(req.query.q || "").trim().toLowerCase();
  const category = String(req.query.category || "").trim().toLowerCase();

  const products = featuredProducts.filter((product) => {
    const matchesQuery =
      !query ||
      [product.name, product.sku, product.category, product.brand]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query));
    const matchesCategory = !category || product.category.toLowerCase() === category;
    return matchesQuery && matchesCategory;
  });

  res.json({ products });
});

app.get("/api/catalog/products", async (req, res) => {
  try {
    const result = await getCatalogProducts(req.query);
    res.json(result);
  } catch (error) {
    res.status(503).json({
      error: "erpnext_catalog_unavailable",
      message: error instanceof Error ? error.message : "Unknown ERPNext catalog error"
    });
  }
});

app.get("/api/catalog/facets", async (_req, res) => {
  try {
    const [itemGroups, diagnostics] = await Promise.all([getCatalogItemGroups(), getCatalogDiagnostics()]);
    const excluded = new Set(diagnostics.storefrontRules.excludedGroups);
    const weakFacetNames = new Set(["All Item Groups", "Products", "Construction project activities"]);
    res.json({
      itemGroups: itemGroups.filter(
        (group) =>
          group.itemCount > 0 &&
          group.showOnStorefront !== false &&
          !excluded.has(group.name) &&
          !excluded.has(group.parent || "") &&
          !weakFacetNames.has(group.name)
      ),
      rules: diagnostics.storefrontRules,
      topGroups: diagnostics.topGroups
    });
  } catch (error) {
    res.status(503).json({
      error: "erpnext_catalog_facets_unavailable",
      message: error instanceof Error ? error.message : "Unknown ERPNext facets error"
    });
  }
});

app.get("/api/storefront/departments", async (_req, res) => {
  try {
    res.json(await getWebsiteDepartments());
  } catch (error) {
    res.status(503).json({
      error: "erpnext_website_departments_unavailable",
      message: error instanceof Error ? error.message : "Unknown ERPNext website department error"
    });
  }
});

app.get("/api/storefront/banners", async (_req, res) => {
  try {
    res.json(await getWebsiteBanners());
  } catch (error) {
    res.status(503).json({
      error: "erpnext_website_banners_unavailable",
      message: error instanceof Error ? error.message : "Unknown ERPNext website banner error"
    });
  }
});

app.get("/api/catalog/product", async (req, res) => {
  try {
    const sku = String(req.query.sku || "").trim();
    if (!sku) {
      res.status(400).json({ error: "sku_required" });
      return;
    }

    const product = await getCatalogProductBySku(sku);
    if (!product) {
      res.status(404).json({ error: "product_not_found" });
      return;
    }
    res.json({ product });
  } catch (error) {
    res.status(503).json({
      error: "erpnext_catalog_unavailable",
      message: error instanceof Error ? error.message : "Unknown ERPNext catalog error"
    });
  }
});

app.get("/api/catalog/related", async (req, res) => {
  try {
    const sku = String(req.query.sku || "").trim();
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || "4"), 10) || 4, 1), 12);
    if (!sku) {
      res.status(400).json({ error: "sku_required" });
      return;
    }

    const product = await getCatalogProductBySku(sku);
    if (!product) {
      res.status(404).json({ error: "product_not_found" });
      return;
    }

    const result = await getCatalogProducts({
      category: product.category,
      pageSize: limit + 1
    });
    res.json({
      products: result.products.filter((item) => item.sku !== sku).slice(0, limit)
    });
  } catch (error) {
    res.status(503).json({
      error: "erpnext_related_products_unavailable",
      message: error instanceof Error ? error.message : "Unknown ERPNext related products error"
    });
  }
});

app.get("/api/catalog/featured", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || "8"), 10) || 8, 1), 24);
    res.json(await getFeaturedCatalogProducts(limit));
  } catch (error) {
    res.status(503).json({
      error: "erpnext_featured_products_unavailable",
      message: error instanceof Error ? error.message : "Unknown ERPNext featured product error"
    });
  }
});

app.get("/api/catalog/products/:sku", async (req, res) => {
  try {
    const product = await getCatalogProductBySku(req.params.sku);
    if (!product) {
      res.status(404).json({ error: "product_not_found" });
      return;
    }
    res.json({ product });
  } catch (error) {
    res.status(503).json({
      error: "erpnext_catalog_unavailable",
      message: error instanceof Error ? error.message : "Unknown ERPNext catalog error"
    });
  }
});

app.get("/api/catalog/item-groups", async (_req, res) => {
  try {
    res.json({ itemGroups: await getCatalogItemGroups() });
  } catch (error) {
    res.status(503).json({
      error: "erpnext_item_groups_unavailable",
      message: error instanceof Error ? error.message : "Unknown ERPNext item group error"
    });
  }
});

app.get("/api/files/:filename", async (req, res) => {
  try {
    const base = (process.env.ERPNEXT_BASE_URL || "http://erp-greenleafpacific-local-frontend-1:8080").replace(/\/+$/, "");
    const upstream = await fetch(`${base}/files/${encodeURIComponent(req.params.filename)}`, {
      headers: process.env.ERPNEXT_SITE_NAME ? { "X-Frappe-Site-Name": process.env.ERPNEXT_SITE_NAME } : {}
    });

    if (!upstream.ok || !upstream.body) {
      res.status(upstream.status || 404).end();
      return;
    }

    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=86400");
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    res.status(404).json({
      error: "erpnext_file_unavailable",
      message: error instanceof Error ? error.message : "Unknown ERPNext file error"
    });
  }
});

app.post("/api/quote-requests", (req, res) => {
  createQuoteRequest(req.body || {})
    .then((result) => {
      const status = result.mode === "validation_failed" ? 422 : result.mode === "created" ? 201 : 200;
      res.status(status).json(result);
    })
    .catch((error) => {
      res.status(503).json({
        error: "erpnext_quote_unavailable",
        message: error instanceof Error ? error.message : "Unknown ERPNext quote error"
      });
    });
});

app.get("/api/account/quotes", (req, res) => {
  const session = getAccountSession(req);
  const email = (session?.email || String(req.query.email || "")).trim().toLowerCase();
  if (!email) {
    res.status(400).json({ error: "email_required" });
    return;
  }

  getWebsiteQuotesByEmail(email, req.query.limit)
    .then((quotes) => res.json({ quotes }))
    .catch((error) => {
      res.status(503).json({
        error: "erpnext_account_quotes_unavailable",
        message: error instanceof Error ? error.message : "Unknown ERPNext account quote error"
      });
    });
});

app.post("/api/account/login/start", (req, res) => {
  const result = startAccountLogin(req.body?.email);
  if (!result.ok) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

app.post("/api/account/login/verify", (req, res) => {
  const result = verifyAccountLogin(req.body?.email, req.body?.code);
  if (!result.ok) {
    res.status(401).json(result);
    return;
  }
  res.json(result);
});

app.get("/api/account/session", async (req, res) => {
  const session = getAccountSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }

  try {
    const [profile, quotes, orders] = await Promise.all([
      getCustomerProfileByEmail(session.email),
      getWebsiteQuotesByEmail(session.email, 20),
      getCustomerOrdersByEmail(session.email, 20)
    ]);
    res.json({ account: { email: session.email, profile, quotes, orders } });
  } catch (error) {
    res.status(503).json({
      error: "erpnext_account_unavailable",
      message: error instanceof Error ? error.message : "Unknown ERPNext account error"
    });
  }
});

app.post("/api/account/logout", (req, res) => {
  const header = String(req.headers.authorization || "");
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  endAccountSession(token);
  res.json({ ok: true });
});

app.get("/api/sync/status", (_req, res) => {
  res.json({
    mode: "prepared",
    sourceSystems: {
      opencart: "local dump/container discovered",
      erpnext: process.env.ERPNEXT_BASE_URL || "not configured"
    },
    inboundToStorefront: ["Item", "Item Group", "Item Price", "Bin", "Website Item", "Customer Price List"],
    outboundToErpnext: ["Lead", "Customer", "Quotation", "Sales Order", "Issue"],
    legacyRules: {
      catalogPriceList: legacySyncRules.catalog.defaults.priceList,
      quoteTarget: legacySyncRules.quote.targetDoctype,
      idempotencyMarker: legacySyncRules.quote.idempotency.newMarker
    },
    pending: ["API credentials", "field mapping approval", "initial full sync dry run"]
  });
});

app.get("/api/sync/legacy-rules", (_req, res) => {
  res.json(legacySyncRules);
});

app.get("/api/admin/catalog-diagnostics", async (_req, res) => {
  try {
    res.json(await getCatalogDiagnostics());
  } catch (error) {
    res.status(503).json({
      error: "erpnext_catalog_diagnostics_unavailable",
      message: error instanceof Error ? error.message : "Unknown ERPNext diagnostics error"
    });
  }
});

app.get("/api/admin/recent-quotes", async (req, res) => {
  try {
    res.json({ quotes: await getRecentWebsiteQuotes(req.query.limit) });
  } catch (error) {
    res.status(503).json({
      error: "erpnext_recent_quotes_unavailable",
      message: error instanceof Error ? error.message : "Unknown ERPNext recent quotes error"
    });
  }
});

app.listen(port, () => {
  console.log(`Green Leaf integration API listening on ${port}`);
});

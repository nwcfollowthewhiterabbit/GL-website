import cors from "cors";
import "dotenv/config";
import express from "express";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  getCatalogDiagnostics,
  getCatalogItemGroups,
  getCatalogQualityReport,
  getCatalogProductBySku,
  getCatalogProducts,
  getCatalogSuggestions,
  getFeaturedCatalogProducts
} from "./catalog-service.mjs";
import { pingErpDb } from "./erpnext-db.mjs";
import { legacySyncRules } from "./legacy-sync-rules.mjs";
import { assertWebsiteMigrationsApplied, websiteMigrationIds } from "./migrations/runner.mjs";
import {
  logEvent,
  metricsText,
  recordPaymentOutcome,
  requestMetrics
} from "./observability.mjs";
import { createQuoteRequest, getRecentWebsiteQuotes } from "./quote-service.mjs";
import { getPaymentConfig } from "./payment-service.mjs";
import {
  createPaymentSessionForAccount,
  processWindcaveNotification
} from "./payment-orchestration-service.mjs";
import {
  getWebsiteBanners,
  getWebsiteCatalogs,
  getWebsiteCustomerCornerSettings,
  getWebsiteDepartments,
  getWebsiteManufacturers
} from "./storefront-control-service.mjs";
import {
  applyStorefrontFallbackPolicy,
  createStorefrontDiagnostics
} from "./storefront-fallback-policy.mjs";
import {
  ACCOUNT_SESSION_COOKIE,
  accountSessionCookieOptions,
  authenticateAccountPassword,
  disableWebsiteCustomerAccess,
  enableWebsiteCustomerAccess,
  endAccountSession,
  getAccountInvoiceDetailByEmail,
  getAccountOrderDetailByEmail,
  getAccountQuotationDetailByEmail,
  getVerifiedAccountSession,
  getCustomerInvoicesByEmail,
  getCustomerOrdersByEmail,
  getCustomerQuotesForAccount,
  getCustomerProfileByEmail,
  getWebsiteCustomerAccessList,
  isAccountLoginAvailable,
  linkWebsiteCustomerAccess,
  setWebsiteCustomerPassword
} from "./account-service.mjs";
import {
  accountLoginLimiter,
  adminLimiter,
  catalogLimiter,
  corsOptions,
  fileProxyLimiter,
  paymentNotificationLimiter,
  paymentSessionLimiter,
  quoteRequestLimiter,
  requireAdminToken
} from "./security.mjs";
import { catalogStats, categories, featuredProducts, manufacturers } from "../src/data/catalog.mjs";

const app = express();
const port = Number(process.env.API_PORT || 3000);

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function qualityReportCsv(report) {
  const header = ["Level", "Name", "Total", "Ready", "Missing image", "Missing price", "Incomplete description"];
  const row = (level, name, item) => [
    level,
    name,
    item.total,
    item.ready,
    item.missingImage,
    item.missingPrice,
    item.incompleteDescription
  ].map(csvCell).join(",");
  return [
    header.map(csvCell).join(","),
    row("Summary", "All products", report.summary),
    ...report.byItemGroup.map((item) => row("Item Group", item.item_group, item)),
    ...report.byBrand.map((item) => row("Brand", item.brand, item))
  ].join("\n");
}

app.disable("x-powered-by");
app.set("trust proxy", 2);
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(requestMetrics);
app.use("/api/account/login", accountLoginLimiter);
app.use("/api/catalog", catalogLimiter);
app.use("/api/storefront", catalogLimiter);
app.use("/api/files", fileProxyLimiter);
app.use("/api/quote-requests", quoteRequestLimiter);
app.use("/api/payments/notification", paymentNotificationLimiter);
app.use("/api/payments/session", paymentSessionLimiter);
app.use("/api/admin", adminLimiter, requireAdminToken);
app.use("/api/sync", adminLimiter, requireAdminToken);

function serviceFailure(res, code, error, status = 503) {
  logEvent("error", "api_request_failed", {
    code,
    cause: error?.code || error?.name || "unknown"
  });
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.status(status).json({ error: code });
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "green-leaf-integration-api",
    migrations: websiteMigrationIds()
  });
});

app.get("/api/payments/config", (_req, res) => {
  res.json(getPaymentConfig());
});

app.post("/api/payments/notification", async (req, res) => {
  try {
    const result = await processWindcaveNotification(req.body || {});
    recordPaymentOutcome(result.outcome, result.effect);
    res.status(202).json({ accepted: result.accepted, outcome: result.outcome });
  } catch (error) {
    recordPaymentOutcome("error", error?.code || "unknown");
    logEvent("error", "payment_notification_failed", { code: error?.code || "unknown" });
    const status = error?.code === "invalid_windcave_notification" || error?.code === "invalid_windcave_session_id" ? 400 : 503;
    res.status(status).json({
      accepted: false,
      error: error?.code || "windcave_notification_failed"
    });
  }
});

app.post("/api/payments/session", async (req, res) => {
  const session = await getVerifiedAccountSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }
  try {
    const result = await createPaymentSessionForAccount(session.email, req.body || {});
    res.status(result.ok ? 200 : 422).json(result);
  } catch (error) {
    res.status(503).json({ ok: false, error: error?.code || "payment_session_failed" });
  }
});

app.get("/api/admin/health", async (_req, res) => {
  let erpnextDbReachable = false;
  try {
    erpnextDbReachable = await pingErpDb();
  } catch {
    erpnextDbReachable = false;
  }
  res.json({
    ok: true,
    erpnextConfigured: Boolean(process.env.ERPNEXT_API_KEY && process.env.ERPNEXT_API_SECRET),
    erpnextDbReachable
  });
});

app.get("/api/admin/metrics", (_req, res) => {
  res.type("text/plain; version=0.0.4").send(metricsText());
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
    serviceFailure(res, "erpnext_catalog_unavailable", error);
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
    serviceFailure(res, "erpnext_catalog_facets_unavailable", error);
  }
});

app.get("/api/catalog/diagnostics", async (_req, res) => {
  try {
    res.json(await getCatalogDiagnostics());
  } catch (error) {
    serviceFailure(res, "erpnext_catalog_diagnostics_unavailable", error);
  }
});

app.get("/api/catalog/suggestions", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || "8"), 10) || 8, 1), 12);
    res.json({ suggestions: await getCatalogSuggestions(q, limit) });
  } catch (error) {
    serviceFailure(res, "erpnext_catalog_suggestions_unavailable", error);
  }
});

app.get("/api/storefront/departments", async (_req, res) => {
  try {
    res.json(applyStorefrontFallbackPolicy(await getWebsiteDepartments(), "departments"));
  } catch (error) {
    serviceFailure(res, "erpnext_website_departments_unavailable", error);
  }
});

app.get("/api/storefront/banners", async (_req, res) => {
  try {
    res.json(applyStorefrontFallbackPolicy(await getWebsiteBanners(), "banners"));
  } catch (error) {
    serviceFailure(res, "erpnext_website_banners_unavailable", error);
  }
});

app.get("/api/storefront/catalogs", async (_req, res) => {
  try {
    res.json(applyStorefrontFallbackPolicy(await getWebsiteCatalogs(), "catalogs"));
  } catch (error) {
    serviceFailure(res, "erpnext_website_catalogs_unavailable", error);
  }
});

app.get("/api/storefront/manufacturers", async (_req, res) => {
  try {
    res.json(applyStorefrontFallbackPolicy(await getWebsiteManufacturers(), "manufacturers"));
  } catch (error) {
    serviceFailure(res, "erpnext_website_manufacturers_unavailable", error);
  }
});

app.get("/api/storefront/customer-corner", async (_req, res) => {
  try {
    const result = await getWebsiteCustomerCornerSettings();
    result.settings.loginEnabled = result.settings.loginEnabled && isAccountLoginAvailable();
    res.json(applyStorefrontFallbackPolicy(result, "customerCorner"));
  } catch (error) {
    serviceFailure(res, "erpnext_customer_corner_settings_unavailable", error);
  }
});

app.get("/api/storefront/diagnostics", async (_req, res) => {
  try {
    const [departments, banners, catalogs, manufacturers, customerCorner] = await Promise.all([
      getWebsiteDepartments(),
      getWebsiteBanners(),
      getWebsiteCatalogs(),
      getWebsiteManufacturers(),
      getWebsiteCustomerCornerSettings()
    ]);
    res.json(createStorefrontDiagnostics({ departments, banners, catalogs, manufacturers, customerCorner }));
  } catch (error) {
    serviceFailure(res, "erpnext_storefront_diagnostics_unavailable", error);
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
    serviceFailure(res, "erpnext_catalog_unavailable", error);
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
    serviceFailure(res, "erpnext_related_products_unavailable", error);
  }
});

app.get("/api/catalog/featured", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || "8"), 10) || 8, 1), 24);
    res.json(await getFeaturedCatalogProducts(limit));
  } catch (error) {
    serviceFailure(res, "erpnext_featured_products_unavailable", error);
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
    serviceFailure(res, "erpnext_catalog_unavailable", error);
  }
});

app.get("/api/catalog/item-groups", async (_req, res) => {
  try {
    res.json({ itemGroups: await getCatalogItemGroups() });
  } catch (error) {
    serviceFailure(res, "erpnext_item_groups_unavailable", error);
  }
});

app.get("/api/files/:filename", async (req, res) => {
  try {
    if (!req.params.filename || req.params.filename.length > 180) {
      res.status(400).json({ error: "invalid_filename" });
      return;
    }
    const base = (process.env.ERPNEXT_BASE_URL || "http://erp-greenleafpacific-local-frontend-1:8080").replace(/\/+$/, "");
    const upstream = await fetch(`${base}/files/${encodeURIComponent(req.params.filename)}`, {
      headers: process.env.ERPNEXT_SITE_NAME ? { "X-Frappe-Site-Name": process.env.ERPNEXT_SITE_NAME } : {},
      signal: AbortSignal.timeout(10_000)
    });

    if (!upstream.ok || !upstream.body) {
      res.status(upstream.status === 404 ? 404 : 502).end();
      return;
    }

    const maxBytes = 25 * 1024 * 1024;
    const contentLength = Number(upstream.headers.get("content-length") || 0);
    if (contentLength > maxBytes) {
      res.status(413).json({ error: "file_too_large" });
      return;
    }

    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=86400");
    let receivedBytes = 0;
    const byteLimiter = new Transform({
      transform(chunk, _encoding, callback) {
        receivedBytes += chunk.length;
        callback(receivedBytes <= maxBytes ? null : new Error("upstream_file_exceeds_limit"), chunk);
      }
    });
    await pipeline(Readable.fromWeb(upstream.body), byteLimiter, res);
  } catch (error) {
    serviceFailure(res, "erpnext_file_unavailable", error, 404);
  }
});

app.post("/api/quote-requests", (req, res) => {
  createQuoteRequest(req.body || {})
    .then((result) => {
      const status = result.mode === "validation_failed" ? 422 : result.mode === "created" ? 201 : 200;
      res.status(status).json(result);
    })
    .catch((error) => {
      serviceFailure(res, "erpnext_quote_unavailable", error);
    });
});

app.get("/api/account/quotes", async (req, res) => {
  const session = await getVerifiedAccountSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }

  getCustomerQuotesForAccount(session.email, req.query.limit)
    .then((quotes) => res.json({ quotes }))
    .catch((error) => {
      serviceFailure(res, "erpnext_account_quotes_unavailable", error);
    });
});

app.post("/api/account/login", async (req, res) => {
  try {
    const result = await authenticateAccountPassword(req.body?.email, req.body?.password);
    if (!result.ok) {
      res.status(result.error === "account_login_unavailable" ? 503 : 401).json(result);
      return;
    }
    res.cookie(ACCOUNT_SESSION_COOKIE, result.token, accountSessionCookieOptions(req));
    res.json({ ok: true, email: result.email, expiresAt: result.expiresAt });
  } catch {
    res.status(503).json({ ok: false, error: "account_login_failed" });
  }
});

app.get("/api/account/session", async (req, res) => {
  const session = await getVerifiedAccountSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }

  try {
    const [profile, quotes, orders, invoices] = await Promise.all([
      getCustomerProfileByEmail(session.email),
      getCustomerQuotesForAccount(session.email, 20),
      getCustomerOrdersByEmail(session.email, 20),
      getCustomerInvoicesByEmail(session.email, 20)
    ]);
    res.json({ account: { email: session.email, profile, quotes, orders, invoices } });
  } catch (error) {
    serviceFailure(res, "erpnext_account_unavailable", error);
  }
});

app.get("/api/account/invoices/:name", async (req, res) => {
  const session = await getVerifiedAccountSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }

  try {
    const invoice = await getAccountInvoiceDetailByEmail(session.email, req.params.name);
    if (!invoice) {
      res.status(404).json({ error: "invoice_not_found" });
      return;
    }
    res.json({ invoice });
  } catch (error) {
    serviceFailure(res, "erpnext_account_invoice_detail_unavailable", error);
  }
});

app.get("/api/account/quotes/:name", async (req, res) => {
  const session = await getVerifiedAccountSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }

  try {
    const quote = await getAccountQuotationDetailByEmail(session.email, req.params.name);
    if (!quote) {
      res.status(404).json({ error: "quote_not_found" });
      return;
    }
    res.json({ quote });
  } catch (error) {
    serviceFailure(res, "erpnext_account_quote_detail_unavailable", error);
  }
});

app.get("/api/account/orders/:name", async (req, res) => {
  const session = await getVerifiedAccountSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }

  try {
    const order = await getAccountOrderDetailByEmail(session.email, req.params.name);
    if (!order) {
      res.status(404).json({ error: "order_not_found" });
      return;
    }
    res.json({ order });
  } catch (error) {
    serviceFailure(res, "erpnext_account_order_detail_unavailable", error);
  }
});

app.post("/api/account/logout", (req, res) => {
  endAccountSession();
  res.clearCookie(ACCOUNT_SESSION_COOKIE, {
    ...accountSessionCookieOptions(req),
    maxAge: undefined
  });
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
    serviceFailure(res, "erpnext_catalog_diagnostics_unavailable", error);
  }
});

app.get("/api/admin/catalog-quality-report", async (_req, res) => {
  try {
    res.json(await getCatalogQualityReport());
  } catch (error) {
    serviceFailure(res, "erpnext_catalog_quality_report_unavailable", error);
  }
});

app.get("/api/admin/catalog-quality-report.csv", async (_req, res) => {
  try {
    const report = await getCatalogQualityReport();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="green-leaf-catalog-quality-${report.generatedAt.slice(0, 10)}.csv"`);
    res.send(qualityReportCsv(report));
  } catch (error) {
    serviceFailure(res, "erpnext_catalog_quality_report_unavailable", error);
  }
});

app.get("/api/admin/recent-quotes", async (req, res) => {
  try {
    res.json({ quotes: await getRecentWebsiteQuotes(req.query.limit) });
  } catch (error) {
    serviceFailure(res, "erpnext_recent_quotes_unavailable", error);
  }
});

app.get("/api/admin/customer-access", async (req, res) => {
  try {
    res.json({ customers: await getWebsiteCustomerAccessList({ q: req.query.q, limit: req.query.limit }) });
  } catch (error) {
    serviceFailure(res, "erpnext_customer_access_unavailable", error);
  }
});

app.post("/api/admin/customer-access/link", async (req, res) => {
  try {
    const result = await linkWebsiteCustomerAccess(req.body || {});
    res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    serviceFailure(res, "erpnext_customer_access_link_unavailable", error);
  }
});

app.post("/api/admin/customer-access/password", async (req, res) => {
  try {
    const result = await setWebsiteCustomerPassword(req.body || {});
    res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    serviceFailure(res, "erpnext_customer_password_update_unavailable", error);
  }
});

app.post("/api/admin/customer-access/disable", async (req, res) => {
  try {
    const result = await disableWebsiteCustomerAccess(req.body?.email);
    res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    serviceFailure(res, "erpnext_customer_access_disable_unavailable", error);
  }
});

app.post("/api/admin/customer-access/enable", async (req, res) => {
  try {
    const result = await enableWebsiteCustomerAccess(req.body?.email);
    res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    serviceFailure(res, "erpnext_customer_access_enable_unavailable", error);
  }
});

await assertWebsiteMigrationsApplied();
app.listen(port, () => {
  logEvent("info", "api_started", { port, migrations: websiteMigrationIds() });
});

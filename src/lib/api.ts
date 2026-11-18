import type {
  AccountLoginResponse,
  AccountConfig,
  AccountActionResult,
  AccountHistoryKind,
  CustomerOrder,
  CustomerInvoice,
  AccountInvoiceDetail,
  AccountOrderDetail,
  AccountQuoteDetail,
  AccountSession,
  CatalogDiagnostics,
  CatalogFacets,
  CatalogProduct,
  CatalogProductsResponse,
  CatalogSuggestion,
  ItemGroup,
  QuoteRequestPayload,
  QuoteRequestResponse,
  RecentQuote,
  WebsiteBanner,
  WebsiteCatalogDownload,
  WebsiteCategory,
  CustomerCornerSettings,
  WebsiteManufacturer
} from "../types";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} failed`);
  return response.json();
}

export function fetchCatalogProducts(params: {
  page: number;
  pageSize: number;
  q?: string;
  category?: string;
  categories?: string;
  sort?: string;
  minPrice?: string;
  maxPrice?: string;
}) {
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize)
  });
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  if (params.categories?.length) search.set("categories", params.categories);
  if (params.sort) search.set("sort", params.sort);
  if (params.minPrice) search.set("minPrice", params.minPrice);
  if (params.maxPrice) search.set("maxPrice", params.maxPrice);
  return getJson<CatalogProductsResponse>(`/api/catalog/products?${search.toString()}`);
}

export async function fetchCatalogProduct(sku: string, uom?: string) {
  const search = new URLSearchParams({ sku });
  if (uom) search.set("uom", uom);
  const data = await getJson<{ product: CatalogProduct }>(`/api/catalog/product?${search.toString()}`);
  return data.product;
}

export async function fetchCatalogSuggestions(q: string, limit = 8) {
  const search = new URLSearchParams({ q, limit: String(limit) });
  const data = await getJson<{ suggestions: CatalogSuggestion[] }>(`/api/catalog/suggestions?${search.toString()}`);
  return data.suggestions || [];
}

export async function fetchRelatedCatalogProducts(sku: string, limit = 4) {
  const search = new URLSearchParams({ sku, limit: String(limit) });
  const data = await getJson<{ products: CatalogProduct[] }>(`/api/catalog/related?${search.toString()}`);
  return data.products || [];
}

export async function fetchFeaturedCatalogProducts(limit = 8) {
  const search = new URLSearchParams({ limit: String(limit) });
  const data = await getJson<{ source: string; products: CatalogProduct[] }>(`/api/catalog/featured?${search.toString()}`);
  return data.products || [];
}

export async function fetchItemGroups() {
  const data = await getJson<{ itemGroups: ItemGroup[] }>("/api/catalog/item-groups");
  return data.itemGroups || [];
}

export function fetchCatalogDiagnostics() {
  return getJson<CatalogDiagnostics>("/api/catalog/diagnostics");
}

export function fetchCatalogFacets() {
  return getJson<CatalogFacets>("/api/catalog/facets");
}

export function fetchWebsiteDepartmentsResource() {
  return getJson<{ source: string; departments: WebsiteCategory[] }>("/api/storefront/departments");
}

export function fetchWebsiteBannersResource() {
  return getJson<{ source: string; banners: WebsiteBanner[] }>("/api/storefront/banners");
}

export function fetchWebsiteCatalogsResource() {
  return getJson<{ source: string; catalogs: WebsiteCatalogDownload[] }>("/api/storefront/catalogs");
}

export function fetchWebsiteManufacturersResource() {
  return getJson<{ source: string; manufacturers: WebsiteManufacturer[] }>("/api/storefront/manufacturers");
}

export function fetchCustomerCornerSettingsResource() {
  return getJson<{ source: string; settings: CustomerCornerSettings }>("/api/storefront/customer-corner");
}

export async function loginAccount(email: string, password: string): Promise<AccountLoginResponse> {
  const response = await fetch("/api/account/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return response.json();
}

export async function fetchAccountSession() {
  const response = await fetch("/api/account/session");
  if (!response.ok) throw Object.assign(new Error("account_session_failed"), { status: response.status });
  const data = (await response.json()) as { account: AccountSession };
  return data.account;
}

export async function fetchAccountQuoteDetail(name: string) {
  const response = await fetch(`/api/account/quotes/${encodeURIComponent(name)}`);
  if (!response.ok) throw new Error("account_quote_detail_failed");
  const data = (await response.json()) as { quote: AccountQuoteDetail };
  return data.quote;
}

export async function fetchAccountOrderDetail(name: string) {
  const response = await fetch(`/api/account/orders/${encodeURIComponent(name)}`);
  if (!response.ok) throw new Error("account_order_detail_failed");
  const data = (await response.json()) as { order: AccountOrderDetail };
  return data.order;
}

export async function fetchAccountInvoiceDetail(name: string) {
  const response = await fetch(`/api/account/invoices/${encodeURIComponent(name)}`);
  if (!response.ok) throw new Error("account_invoice_detail_failed");
  const data = (await response.json()) as { invoice: AccountInvoiceDetail };
  return data.invoice;
}

export async function logoutAccount() {
  const response = await fetch("/api/account/logout", { method: "POST" });
  if (!response.ok) throw new Error("account_logout_failed");
}

const quoteRequestStorageKey = "greenleaf.lastQuoteRequest";
const quoteRetryWindowMs = 24 * 60 * 60 * 1000;

async function requestDigest(serialized: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serialized));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function purgeLegacyQuoteDetails() {
  try {
    const storage = window.localStorage;
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      if (key?.startsWith("greenleaf.quoteDetails.")) storage.removeItem(key);
    }

    // Preserve the retry ID for a pre-upgrade request with an uncertain outcome.
    const previous = storage.getItem(quoteRequestStorageKey);
    if (!previous) return;
    let cached;
    try { cached = JSON.parse(previous); } catch { /* Discard obsolete or corrupt entries. */ }
    if (!cached?.id || !cached.createdAt || Date.now() - cached.createdAt >= quoteRetryWindowMs) {
      storage.removeItem(quoteRequestStorageKey);
    } else if (typeof cached.fingerprint === "string" && cached.fingerprint.startsWith("{")) {
      let sanitized: string | null = null;
      try {
        const fingerprint = await requestDigest(cached.fingerprint);
        sanitized = JSON.stringify({ id: cached.id, createdAt: cached.createdAt, fingerprint });
      } finally {
        // Another tab may have confirmed this request or started a different one.
        if (storage.getItem(quoteRequestStorageKey) === previous) {
          if (sanitized) storage.setItem(quoteRequestStorageKey, sanitized);
          else storage.removeItem(quoteRequestStorageKey);
        }
      }
    }
  } catch { /* Private browsing may disable persistent storage. */ }
}

export async function createQuoteRequest(payload: QuoteRequestPayload): Promise<QuoteRequestResponse> {
  const storageKey = quoteRequestStorageKey;
  let id = payload.id;
  if (!id && typeof window !== "undefined") {
    try {
      const serialized = JSON.stringify(payload);
      const fingerprint = await requestDigest(serialized);
      const previous = JSON.parse(window.localStorage.getItem(storageKey) || "null");
      const sameRequest = previous?.fingerprint === fingerprint || previous?.fingerprint === serialized;
      const stillReusable = sameRequest && Date.now() - Number(previous?.createdAt || 0) < quoteRetryWindowMs;
      id = stillReusable ? previous.id : `GLQ-${crypto.randomUUID()}`;
      window.localStorage.setItem(storageKey, JSON.stringify({ fingerprint, id, createdAt: Date.now() }));
    } catch {
      id = `GLQ-${Date.now()}`;
    }
  }

  const response = await fetch("/api/quote-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, id })
  });
  const result = await response.json() as QuoteRequestResponse;
  const reference = typeof result.quotation === "string" ? result.quotation : result.quotation?.name;
  if (response.ok && reference && (result.mode === "created" || result.mode === "idempotent") && typeof window !== "undefined") {
    try {
      const cached = JSON.parse(window.localStorage.getItem(storageKey) || "null");
      // A confirmed request is complete. Retain a newer request cached by another tab.
      if (cached?.id === id) window.localStorage.removeItem(storageKey);
    } catch { /* Browser storage is optional; uncertain requests retain their retry identity. */ }
  }
  return result;
}

export function fetchAccountConfig() {
  return getJson<AccountConfig>("/api/account/config");
}

export async function accountAction(path: string, body: Record<string, string>): Promise<AccountActionResult> {
  const response = await fetch(`/api/account/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (response.status === 429) return { ok: false, error: "too_many_requests" };
  return response.json();
}

export function fetchAccountHistory(kind: AccountHistoryKind, offset: number) {
  return getJson<{
    quotes?: RecentQuote[];
    orders?: CustomerOrder[];
    invoices?: CustomerInvoice[];
    hasMore: boolean;
    nextOffset: number | null;
  }>(`/api/account/${kind}?limit=20&offset=${offset}`);
}

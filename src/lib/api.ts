import type {
  CatalogDiagnostics,
  CatalogFacets,
  CatalogProduct,
  CatalogProductsResponse,
  ItemGroup,
  QuoteRequestPayload,
  QuoteRequestResponse,
  RecentQuote
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
  categories?: string[];
}) {
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize)
  });
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  if (params.categories?.length) search.set("categories", params.categories.join(","));
  return getJson<CatalogProductsResponse>(`/api/catalog/products?${search.toString()}`);
}

export async function fetchCatalogProduct(sku: string) {
  const search = new URLSearchParams({ sku });
  const data = await getJson<{ product: CatalogProduct }>(`/api/catalog/product?${search.toString()}`);
  return data.product;
}

export async function fetchRelatedCatalogProducts(sku: string, limit = 4) {
  const search = new URLSearchParams({ sku, limit: String(limit) });
  const data = await getJson<{ products: CatalogProduct[] }>(`/api/catalog/related?${search.toString()}`);
  return data.products || [];
}

export async function fetchItemGroups() {
  const data = await getJson<{ itemGroups: ItemGroup[] }>("/api/catalog/item-groups");
  return data.itemGroups || [];
}

export function fetchCatalogDiagnostics() {
  return getJson<CatalogDiagnostics>("/api/admin/catalog-diagnostics");
}

export function fetchCatalogFacets() {
  return getJson<CatalogFacets>("/api/catalog/facets");
}

export async function fetchRecentQuotes(limit = 5) {
  const data = await getJson<{ quotes: RecentQuote[] }>(`/api/admin/recent-quotes?limit=${limit}`);
  return data.quotes || [];
}

export async function fetchAccountQuotes(email: string, limit = 20) {
  const search = new URLSearchParams({ email, limit: String(limit) });
  const data = await getJson<{ quotes: RecentQuote[] }>(`/api/account/quotes?${search.toString()}`);
  return data.quotes || [];
}

export async function createQuoteRequest(payload: QuoteRequestPayload): Promise<QuoteRequestResponse> {
  const response = await fetch("/api/quote-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return response.json();
}

export type StorefrontRoute =
  | { view: "catalog"; categorySlug?: string; itemGroupSlug?: string; search?: string }
  | { view: "product"; sku: string }
  | { view: "account" }
  | { view: "policy"; policy: PolicySlug }
  | { view: "not-found" };

export type PolicySlug = "privacy" | "terms" | "shipping" | "returns" | "payment-security";

const policyPaths = new Map<string, PolicySlug>([
  ["/privacy", "privacy"],
  ["/privacy-policy", "privacy"],
  ["/terms", "terms"],
  ["/terms-and-conditions", "terms"],
  ["/shipping", "shipping"],
  ["/delivery", "shipping"],
  ["/returns", "returns"],
  ["/refunds", "returns"],
  ["/cancellation", "returns"],
  ["/payment-security", "payment-security"],
  ["/checkout", "payment-security"]
]);

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function catalogPath(category?: string) {
  if (!category) return "/catalog";
  return `/catalog/${slugify(category)}`;
}

export function departmentCategoryPath(departmentId: string, category: string) {
  if (!departmentId) return catalogPath(category);
  return `/catalog/${departmentId}/${slugify(category)}`;
}

export function productPath(sku: string) {
  return `/products/${encodeURIComponent(sku)}`;
}

export function parseStorefrontRoute(pathname = window.location.pathname, search = window.location.search): StorefrontRoute {
  const queryIndex = pathname.indexOf("?");
  const routePath = queryIndex >= 0 ? pathname.slice(0, queryIndex) : pathname;
  const query = queryIndex >= 0 ? pathname.slice(queryIndex) : search;
  const searchTerm = new URLSearchParams(query).get("q") || undefined;
  const path = routePath.replace(/\/+$/, "") || "/";

  if (path.startsWith("/products/")) {
    return {
      view: "product",
      sku: decodeURIComponent(path.slice("/products/".length))
    };
  }

  if (path.startsWith("/catalog/")) {
    const [categorySlug, itemGroupSlug] = path
      .slice("/catalog/".length)
      .split("/")
      .filter(Boolean);
    return {
      view: "catalog",
      categorySlug,
      itemGroupSlug,
      search: searchTerm
    };
  }

  if (path === "/account") {
    return { view: "account" };
  }

  const policy = policyPaths.get(path);
  if (policy) return { view: "policy", policy };

  if (path !== "/" && path !== "/catalog") return { view: "not-found" };

  return { view: "catalog", search: searchTerm };
}

export function findCategoryBySlug(categories: string[], slug?: string) {
  if (!slug) return "";
  return categories.find((category) => slugify(category) === slug) || "";
}

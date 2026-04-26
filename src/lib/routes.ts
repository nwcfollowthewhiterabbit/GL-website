export type StorefrontRoute =
  | { view: "catalog"; categorySlug?: string }
  | { view: "product"; sku: string }
  | { view: "account" };

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

export function productPath(sku: string) {
  return `/products/${encodeURIComponent(sku)}`;
}

export function parseStorefrontRoute(pathname = window.location.pathname): StorefrontRoute {
  const path = pathname.replace(/\/+$/, "") || "/";

  if (path.startsWith("/products/")) {
    return {
      view: "product",
      sku: decodeURIComponent(path.slice("/products/".length))
    };
  }

  if (path.startsWith("/catalog/")) {
    return {
      view: "catalog",
      categorySlug: path.slice("/catalog/".length)
    };
  }

  if (path === "/account") {
    return { view: "account" };
  }

  return { view: "catalog" };
}

export function findCategoryBySlug(categories: string[], slug?: string) {
  if (!slug) return "";
  return categories.find((category) => slugify(category) === slug) || "";
}

import type { CatalogProduct } from "../types";

const productPlaceholder = "/product-placeholder.svg";

export { productPlaceholder };

export function productImage(product: CatalogProduct) {
  if (product.image?.startsWith("http")) {
    return product.image;
  }
  if (product.image?.startsWith("/files/")) {
    return `/api${product.image}`;
  }

  return productPlaceholder;
}

export function priceLabel(product: CatalogProduct) {
  if (product.priceMode === "Hide Price" || product.price === "Hide Price") return "Contact sales";
  if (product.priceMode === "Quote Only" || product.price === "Quote Only") return "Quote only";
  if (typeof product.price === "string") return product.price;
  if (product.price <= 0) return "Quote only";
  return `${product.price.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })} ${product.currency || "FJD"}`;
}

export function availabilityLabel(product: CatalogProduct) {
  if (product.status) return product.status;
  if (product.stockDisplay === "Hidden") return "Contact for availability";
  if (product.stockDisplay === "Special Order") return "Special order";
  if (product.stockDisplay === "Quantity" && typeof product.quantity === "number") {
    return product.quantity > 0 ? `${product.quantity.toLocaleString()} in stock` : "Special order";
  }
  if (product.availability === "available") return "Available";
  if (product.availability === "special_order") return "Special order";
  if (product.availability === "hidden_no_price") return "Quote only";
  return "ERPNext item";
}

export function plainTextDescription(product: CatalogProduct, fallback: string, maxLength = 112) {
  return (product.description || fallback)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function availabilityTone(product: CatalogProduct) {
  const label = availabilityLabel(product).toLowerCase();
  if (label.includes("available") || label.includes("stock")) return "available";
  if (label.includes("quote") || label.includes("contact")) return "quote";
  return "special";
}

export function productSpecs(product: CatalogProduct) {
  return [
    { label: "SKU", value: product.sku },
    { label: "Category", value: product.category },
    { label: "UOM", value: product.uom || "Each" },
    { label: "Availability", value: availabilityLabel(product) },
    { label: "Price", value: priceLabel(product) }
  ];
}

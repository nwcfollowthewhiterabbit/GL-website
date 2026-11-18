import type { CatalogProduct, QuoteLine } from "../types";

const productPlaceholder = "/product-placeholder.svg";

export { productPlaceholder };

export function productImage(product: CatalogProduct) {
  if (product.image?.startsWith("/catalog-reviewed/") || product.image?.startsWith("/image/")) return product.image;
  // Old baskets may contain a URL serialized before the public images moved.
  if (product.image && /^(?:https?:)?\/\/(?:www\.)?greenleafpacific\.com(?:[/:?#]|$)/i.test(product.image)) {
    try {
      const path = new URL(product.image, "https://greenleafpacific.com").pathname;
      return path.startsWith("/image/") ? path : productPlaceholder;
    } catch {
      return productPlaceholder;
    }
  }
  if (product.image?.startsWith("http")) {
    return product.image;
  }
  if (product.image?.startsWith("/files/")) {
    return `/api${product.image}`;
  }

  return productPlaceholder;
}

export function orderStep(product: CatalogProduct) {
  return Math.max(1, Number(product.packingUnit) || 1);
}

export function nextOrderQuantity(product: CatalogProduct, qty: number, direction: 1 | -1) {
  const step = orderStep(product);
  const next = direction === 1 ? Math.floor(qty / step) + 1 : Math.ceil(qty / step) - 1;
  return Math.max(1, Math.min(Math.floor(1000 / step), next)) * step;
}

export function offerKey(product: Pick<CatalogProduct, "sku" | "uom">) {
  return JSON.stringify([product.sku, product.uom || ""]);
}

export function sellingUnitLabel(product: CatalogProduct) {
  return product.uom ? `Selling unit: ${product.uom}` : "Contact sales for the selling unit";
}

// Keep only the product details needed to identify a saved pack and its quantity.
// This same projection upgrades baskets written by versions that stored entire API responses.
export function basketLine(product: CatalogProduct, qty: number, unitConfirmed: boolean): QuoteLine {
  return {
    sku: product.sku,
    name: product.name || product.sku,
    category: product.category || "",
    uom: product.uom,
    packingUnit: product.packingUnit,
    image: product.image,
    qty,
    unitConfirmed: Boolean(product.uom && unitConfirmed)
  };
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

export function isSpecialOrder(product: CatalogProduct) {
  return product.stockDisplay === "Special Order" || product.availability === "special_order" || Number(product.quantity || 0) <= 0;
}

export function requiresAvailabilityConfirmation(product: CatalogProduct, requestedQty = 1) {
  if (isSpecialOrder(product)) return true;
  if (product.availability !== "available") return true;
  return typeof product.quantity === "number" && product.quantity < requestedQty;
}

export function purchaseFlowLabel(product: CatalogProduct) {
  if (orderStep(product) > 1) return `Order in multiples of ${orderStep(product)}`;
  if (isSpecialOrder(product)) return "Sales will confirm availability and lead time";
  return "Sales will confirm stock and delivery";
}

export function productSpecs(product: CatalogProduct) {
  return [
    { label: "SKU", value: product.sku },
    { label: "Category", value: product.category },
    { label: "Selling unit", value: product.uom || "Confirm with sales" },
    { label: "Availability", value: availabilityLabel(product) }
  ];
}

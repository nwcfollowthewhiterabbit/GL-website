import type { CatalogProduct } from "../types";

const fallbackImageByCategory = {
  cleaning:
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=75",
  furniture:
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=75",
  kitchen:
    "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=75",
  default:
    "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=900&q=75"
};

export function productImage(product: CatalogProduct) {
  if (product.image?.startsWith("http")) {
    return product.image;
  }
  if (product.image?.startsWith("/files/")) {
    return `/api${product.image}`;
  }

  const category = product.category.toLowerCase();
  if (category.includes("clean") || category.includes("karcher")) return fallbackImageByCategory.cleaning;
  if (category.includes("furniture") || category.includes("fitout")) return fallbackImageByCategory.furniture;
  if (category.includes("kitchen") || category.includes("food")) return fallbackImageByCategory.kitchen;
  return fallbackImageByCategory.default;
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
  return (product.description || fallback).replace(/<[^>]*>/g, "").slice(0, maxLength);
}

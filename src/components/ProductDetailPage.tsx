import { ArrowLeft, CheckCircle2, Clock3, PackageCheck, Ruler, ShoppingCart, Tag } from "lucide-react";
import {
  availabilityLabel,
  availabilityTone,
  plainTextDescription,
  offerKey, orderStep, sellingUnitLabel,
  productImage,
  productPlaceholder,
  productSpecs
} from "../lib/catalog";
import type { CatalogProduct } from "../types";

type ProductDetailPageProps = {
  product: CatalogProduct | null;
  isLoading: boolean;
  unavailable: boolean;
  relatedProducts: CatalogProduct[];
  onBackToCatalog: () => void;
  onAddToQuote: (product: CatalogProduct) => void;
  onSelectRelated: (product: CatalogProduct) => void;
};

export function ProductDetailPage({
  product,
  isLoading,
  unavailable,
  relatedProducts,
  onBackToCatalog,
  onAddToQuote,
  onSelectRelated
}: ProductDetailPageProps) {
  const specs = product ? productSpecs(product) : [];

  return (
    <section className="shell section product-page">
      <button type="button" className="secondary-button product-page__back" onClick={onBackToCatalog}>
        <ArrowLeft size={18} /> Back to catalog
      </button>

      {isLoading ? (
        <div className="product-page__empty">Loading product details...</div>
      ) : product ? (
        <>
          <div className="breadcrumbs" aria-label="Breadcrumb">
            <button type="button" onClick={onBackToCatalog}>Catalog</button>
            <span>/</span>
            <span>{product.category}</span>
            <span>/</span>
            <strong>{product.name}</strong>
          </div>
          <div className="product-page__hero">
            <div className="product-page__media-panel">
              <div className="product-page__media">
                <img
                  src={productImage(product)}
                  alt=""
                  onError={(event) => {
                    event.currentTarget.src = productPlaceholder;
                  }}
                />
              </div>
              <div className="product-page__media-meta">
                <span>
                  <Tag size={15} /> {product.category}
                </span>
                <span>
                  <Ruler size={15} /> {product.uom || "Confirm unit with sales"}
                </span>
              </div>
            </div>
            <div className="product-page__body">
              <div className="product-page__kicker">
                <span className={`availability-badge is-${availabilityTone(product)}`}>{availabilityLabel(product)}</span>
                <span className="sku-chip">{product.sku}</span>
              </div>
              <h1>{product.name}</h1>
              <p>{plainTextDescription(product, "No product description available.", 1200)}</p>

              <div className="product-page__specs" aria-label="Product specifications">
                {specs.map((spec) => (
                  <div key={spec.label}>
                    <span>{spec.label}</span>
                    <strong>{spec.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <aside className="product-quote-panel" aria-label="Order this product">
              <span className="product-quote-panel__label">Order preparation</span>
              <strong>{sellingUnitLabel(product)}</strong>
              <p>{orderStep(product) > 1 && `Order in multiples of ${orderStep(product)}. `}Add this product to your basket and request a quote. Sales will confirm final pricing, stock and delivery.</p>
              <button type="button" className="quote-button product-page__quote" onClick={() => onAddToQuote(product)}>
                <ShoppingCart size={18} /> Add to basket
              </button>
              <div className="product-quote-panel__notes">
                <span>
                  <CheckCircle2 size={16} /> Product reference ready for your quotation
                </span>
                <span>
                  <Clock3 size={16} /> In-stock delivery normally within 72 hours
                </span>
                <span>
                  <PackageCheck size={16} /> Commercial order handling
                </span>
              </div>
            </aside>
          </div>

          <div className="related-products">
            <div className="section-heading">
              <div>
                <h2>Related items</h2>
                <p>Explore more products in this category.</p>
              </div>
            </div>
            {relatedProducts.length ? (
              <div className="related-products__grid">
                {relatedProducts.map((item) => (
                  <button className="related-product" key={offerKey(item)} onClick={() => onSelectRelated(item)}>
                    <img
                      src={productImage(item)}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.src = productPlaceholder;
                      }}
                    />
                    <span>{item.name}</span>
                    <strong>{sellingUnitLabel(item)}</strong>
                  </button>
                ))}
              </div>
            ) : (
              <p className="empty-state">
                <PackageCheck size={18} /> Browse the catalog to find more products.
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="product-page__empty">{unavailable ? "Product details are temporarily unavailable. Please reload this page to try again." : "This product could not be found in the catalog."}</div>
      )}
    </section>
  );
}

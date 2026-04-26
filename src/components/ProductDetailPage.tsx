import { ArrowLeft, CheckCircle2, Clock3, PackageCheck, Ruler, ShoppingCart, Tag } from "lucide-react";
import {
  availabilityLabel,
  availabilityTone,
  plainTextDescription,
  priceLabel,
  productImage,
  productPlaceholder,
  productSpecs
} from "../lib/catalog";
import type { CatalogProduct } from "../types";

type ProductDetailPageProps = {
  product: CatalogProduct | null;
  isLoading: boolean;
  relatedProducts: CatalogProduct[];
  onBackToCatalog: () => void;
  onAddToQuote: (product: CatalogProduct) => void;
  onSelectRelated: (product: CatalogProduct) => void;
};

export function ProductDetailPage({
  product,
  isLoading,
  relatedProducts,
  onBackToCatalog,
  onAddToQuote,
  onSelectRelated
}: ProductDetailPageProps) {
  const specs = product ? productSpecs(product) : [];
  const primarySpecs = specs.slice(0, 4);
  const secondarySpecs = specs.slice(4);

  return (
    <section className="shell section product-page">
      <button type="button" className="secondary-button product-page__back" onClick={onBackToCatalog}>
        <ArrowLeft size={18} /> Back to catalog
      </button>

      {isLoading ? (
        <div className="product-page__empty">Loading product from ERPNext...</div>
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
                  <Ruler size={15} /> {product.uom || "Each"}
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
                {primarySpecs.map((spec) => (
                  <div key={spec.label}>
                    <span>{spec.label}</span>
                    <strong>{spec.value}</strong>
                  </div>
                ))}
              </div>
              {secondarySpecs.length ? (
                <div className="product-page__technical">
                  {secondarySpecs.map((spec) => (
                    <span key={spec.label}>
                      {spec.label}: <strong>{spec.value}</strong>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <aside className="product-quote-panel" aria-label="Request quote for this product">
              <span className="product-quote-panel__label">Trade quote</span>
              <strong>{priceLabel(product)}</strong>
              <p>Final price, stock and delivery timing are confirmed by Green Leaf sales.</p>
              <button type="button" className="quote-button product-page__quote" onClick={() => onAddToQuote(product)}>
                <ShoppingCart size={18} /> Add to quote
              </button>
              <div className="product-quote-panel__notes">
                <span>
                  <CheckCircle2 size={16} /> ERP SKU validated
                </span>
                <span>
                  <Clock3 size={16} /> Lead time confirmed after request
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
                <p>More ERPNext products from the same item group.</p>
              </div>
            </div>
            {relatedProducts.length ? (
              <div className="related-products__grid">
                {relatedProducts.map((item) => (
                  <button className="related-product" key={item.sku} onClick={() => onSelectRelated(item)}>
                    <img
                      src={productImage(item)}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.src = productPlaceholder;
                      }}
                    />
                    <span>{item.name}</span>
                    <strong>{priceLabel(item)}</strong>
                  </button>
                ))}
              </div>
            ) : (
              <p className="empty-state">
                <PackageCheck size={18} /> Related products will appear as the ERP group is loaded.
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="product-page__empty">Product was not found in the ERPNext storefront catalog.</div>
      )}
    </section>
  );
}

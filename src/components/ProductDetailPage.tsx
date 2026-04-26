import { ArrowLeft, PackageCheck, ShoppingCart } from "lucide-react";
import { availabilityLabel, plainTextDescription, priceLabel, productImage } from "../lib/catalog";
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
  return (
    <section className="shell section product-page">
      <button className="secondary-button product-page__back" onClick={onBackToCatalog}>
        <ArrowLeft size={18} /> Back to catalog
      </button>

      {isLoading ? (
        <div className="product-page__empty">Loading product from ERPNext...</div>
      ) : product ? (
        <>
          <div className="product-page__layout">
            <div className="product-page__media">
              <img src={productImage(product)} alt="" />
            </div>
            <div className="product-page__body">
              <span className="tag product-page__tag">{product.category}</span>
              <h1>{product.name}</h1>
              <div className="product-page__summary">
                <div>
                  <span>SKU</span>
                  <strong>{product.sku}</strong>
                </div>
                <div>
                  <span>Availability</span>
                  <strong>{availabilityLabel(product)}</strong>
                </div>
                <div>
                  <span>Price</span>
                  <strong>{priceLabel(product)}</strong>
                </div>
              </div>
              <p>{plainTextDescription(product, "No product description available.", 1200)}</p>
              <button className="quote-button product-page__quote" onClick={() => onAddToQuote(product)}>
                <ShoppingCart size={18} /> Add to quote
              </button>
            </div>
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
                    <img src={productImage(item)} alt="" />
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

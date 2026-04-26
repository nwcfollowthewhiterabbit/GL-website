import { ArrowRight, Sparkles } from "lucide-react";
import { priceLabel, productImage, productPlaceholder } from "../lib/catalog";
import type { CatalogProduct } from "../types";

type RecommendedProductsSectionProps = {
  products: CatalogProduct[];
  onSelectProduct: (product: CatalogProduct) => void;
};

export function RecommendedProductsSection({ products, onSelectProduct }: RecommendedProductsSectionProps) {
  if (!products.length) return null;

  return (
    <section className="shell section recommended-section" aria-label="Recommended products">
      <div className="recommended-section__head">
        <div>
          <span className="legacy-panel__label">
            <Sparkles size={18} /> Recommended on website
          </span>
          <h2>You may also be interested in</h2>
        </div>
        <a className="secondary-button" href="/catalog">
          View catalog <ArrowRight size={18} />
        </a>
      </div>

      <div className="recommended-products">
        {products.map((product) => (
          <button className="recommended-product" key={product.sku} onClick={() => onSelectProduct(product)}>
            <img
              src={productImage(product)}
              alt=""
              onError={(event) => {
                event.currentTarget.src = productPlaceholder;
              }}
            />
            <span>{product.name}</span>
            <strong>{priceLabel(product)}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}

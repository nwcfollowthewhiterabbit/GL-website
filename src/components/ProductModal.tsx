import { X } from "lucide-react";
import { availabilityLabel, plainTextDescription, priceLabel, productImage } from "../lib/catalog";
import type { CatalogProduct } from "../types";

type ProductModalProps = {
  product: CatalogProduct | null;
  onClose: () => void;
  onAddToQuote: (product: CatalogProduct) => void;
};

export function ProductModal({ product, onClose, onAddToQuote }: ProductModalProps) {
  if (!product) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <article className="product-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button className="icon-button product-modal__close" onClick={onClose} aria-label="Close product details">
          <X />
        </button>
        <div className="product-modal__media">
          <img src={productImage(product)} alt="" />
        </div>
        <div className="product-modal__body">
          <span className="tag">{product.category}</span>
          <h2>{product.name}</h2>
          <dl>
            <div>
              <dt>SKU</dt>
              <dd>{product.sku}</dd>
            </div>
            <div>
              <dt>Availability</dt>
              <dd>{availabilityLabel(product)}</dd>
            </div>
            <div>
              <dt>Price</dt>
              <dd>{priceLabel(product)}</dd>
            </div>
          </dl>
          <p>{plainTextDescription(product, "No product description available.", 1000)}</p>
          <button className="quote-button" onClick={() => onAddToQuote(product)}>
            Add to quote
          </button>
        </div>
      </article>
    </div>
  );
}

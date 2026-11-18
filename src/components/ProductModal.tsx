import { X } from "lucide-react";
import { useModalFocus } from "../hooks/useModalFocus";
import { availabilityLabel, plainTextDescription, priceLabel, productImage } from "../lib/catalog";
import type { CatalogProduct } from "../types";

type ProductModalProps = {
  product: CatalogProduct | null;
  onClose: () => void;
  onAddToQuote: (product: CatalogProduct) => void;
};

export function ProductModal({ product, onClose, onAddToQuote }: ProductModalProps) {
  const { dialogRef, closeButtonRef } = useModalFocus(Boolean(product), onClose);
  if (!product) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <article ref={dialogRef} className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-preview-title" onClick={(event) => event.stopPropagation()}>
        <button ref={closeButtonRef} className="icon-button product-modal__close" onClick={onClose} aria-label="Close product details">
          <X />
        </button>
        <div className="product-modal__media">
          <img src={productImage(product)} alt="" />
        </div>
        <div className="product-modal__body">
          <span className="tag">{product.category}</span>
          <h2 id="product-preview-title">{product.name}</h2>
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
              <dd>{priceLabel(product)} excl. VAT</dd>
            </div>
          </dl>
          <p>{plainTextDescription(product, "No product description available.", 1000)}</p>
          <button className="quote-button" onClick={() => { onClose(); onAddToQuote(product); }}>
            Add to basket
          </button>
        </div>
      </article>
    </div>
  );
}

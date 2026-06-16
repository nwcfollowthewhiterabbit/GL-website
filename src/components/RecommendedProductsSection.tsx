import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { priceLabel, productImage, productPlaceholder } from "../lib/catalog";
import type { CatalogProduct } from "../types";

type RecommendedProductsSectionProps = {
  products: CatalogProduct[];
  onSelectProduct: (product: CatalogProduct) => void;
};

export function RecommendedProductsSection({ products, onSelectProduct }: RecommendedProductsSectionProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const isPausedRef = useRef(false);

  useEffect(() => {
    if (products.length <= 3) return;

    const timer = window.setInterval(() => {
      if (isPausedRef.current || !trackRef.current) return;
      scrollTrack(1);
    }, 4200);

    return () => window.clearInterval(timer);
  }, [products.length]);

  function scrollTrack(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const firstCard = track.querySelector<HTMLElement>(".recommended-product");
    const step = firstCard ? firstCard.offsetWidth + 14 : Math.round(track.clientWidth * 0.8);
    const maxScroll = track.scrollWidth - track.clientWidth;
    const nextLeft = track.scrollLeft + direction * step;

    if (nextLeft > maxScroll - 8) {
      track.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    if (nextLeft < 0) {
      track.scrollTo({ left: maxScroll, behavior: "smooth" });
      return;
    }

    track.scrollBy({ left: direction * step, behavior: "smooth" });
  }

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
        <div className="recommended-section__actions">
          <button type="button" className="icon-button" onClick={() => scrollTrack(-1)} aria-label="Previous recommended products">
            <ArrowLeft size={18} />
          </button>
          <button type="button" className="icon-button" onClick={() => scrollTrack(1)} aria-label="Next recommended products">
            <ArrowRight size={18} />
          </button>
          <a className="secondary-button" href="/catalog">
            View catalog <ArrowRight size={18} />
          </a>
        </div>
      </div>

      <div
        className="recommended-products"
        ref={trackRef}
        onMouseEnter={() => {
          isPausedRef.current = true;
        }}
        onMouseLeave={() => {
          isPausedRef.current = false;
        }}
        onFocus={() => {
          isPausedRef.current = true;
        }}
        onBlur={() => {
          isPausedRef.current = false;
        }}
      >
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

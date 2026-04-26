import { ArrowRight } from "lucide-react";

type CatalogServiceBandProps = {
  onOpenQuote: () => void;
};

export function CatalogServiceBand({ onOpenQuote }: CatalogServiceBandProps) {
  return (
    <section className="catalog-service-band" aria-label="Green Leaf service workflow">
      <div className="shell catalog-service-band__inner">
        <span>One operational workflow</span>
        <h2>From catalog browsing to resort-ready supply planning.</h2>
        <p>
          Build a trade quote across kitchen equipment, buffet service, housekeeping, linen and fitout products. Green Leaf confirms price, stock and lead time from ERPNext.
        </p>
        <button type="button" className="catalog-service-band__button" onClick={onOpenQuote}>
          Request trade quote <ArrowRight size={18} />
        </button>
      </div>
    </section>
  );
}

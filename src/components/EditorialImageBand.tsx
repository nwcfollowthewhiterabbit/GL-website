import { ArrowRight } from "lucide-react";

export function EditorialImageBand() {
  return (
    <section className="editorial-band" aria-label="Hospitality sourcing">
      <div className="editorial-band__overlay">
        <div className="shell editorial-band__inner">
          <span>Hospitality supply partner</span>
          <h2>
            Service-ready tableware, linen and operating supplies for Fiji hospitality.
          </h2>
          <p>
            Source glassware, towels, buffet service, housekeeping and commercial kitchen lines through one Green Leaf trade workflow.
          </p>
          <a className="editorial-band__link" href="/catalog">
            Browse catalog <ArrowRight size={18} />
          </a>
        </div>
      </div>
    </section>
  );
}

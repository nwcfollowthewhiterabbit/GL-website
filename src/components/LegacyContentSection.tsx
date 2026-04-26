import { Sparkles } from "lucide-react";
import { legacyManufacturers } from "../data/legacyContent";
import type { WebsiteManufacturer } from "../types";

type LegacyContentSectionProps = {
  manufacturers: WebsiteManufacturer[];
};

export function LegacyContentSection({ manufacturers }: LegacyContentSectionProps) {
  if (!manufacturers.length) return null;

  return (
    <section className="shell section legacy-section">
      <div className="brands-section" id="brands">
        <div>
          <span className="legacy-panel__label">
            <Sparkles size={18} /> Brands
          </span>
          <h3>Recognized hospitality supply brands</h3>
          <p>
            The old catalog included {legacyManufacturers.length} mapped manufacturers. Brand assets can be refined as
            product images and supplier media are normalized for production.
          </p>
        </div>
        <div>
          {manufacturers.map((brand) => (
            <a className="brand-strip__item" href={brand.url || "/catalog"} key={brand.id}>
              <img src={brand.logo} alt={brand.name} />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

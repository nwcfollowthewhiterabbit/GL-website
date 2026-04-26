import { Sparkles } from "lucide-react";
import { legacyLogoStrip, legacyManufacturers } from "../data/legacyContent";

export function LegacyContentSection() {
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
          {legacyLogoStrip.map((brand) => (
            <div className="brand-strip__item" key={brand.name}>
              <img src={brand.image} alt={brand.name} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

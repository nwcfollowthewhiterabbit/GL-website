import { Sparkles } from "lucide-react";
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
          <h3>Manufacturers</h3>
          <p>Manufacturer logos migrated from the old Green Leaf brands page. Each brand can link into catalog search or a managed ERP storefront rule.</p>
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

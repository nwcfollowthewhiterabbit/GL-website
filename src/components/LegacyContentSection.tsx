import { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import type { WebsiteManufacturer } from "../types";

type LegacyContentSectionProps = {
  manufacturers: WebsiteManufacturer[];
};

export function LegacyContentSection({ manufacturers }: LegacyContentSectionProps) {
  const [expanded, setExpanded] = useState(false);
  if (!manufacturers.length) return null;
  const canExpand = manufacturers.length > 12;

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
        <div className="brands-section__content">
          <div className={`brands-section__logos ${canExpand && !expanded ? "is-collapsed" : ""}`}>
            {manufacturers.map((brand) => (
              <a className="brand-strip__item" href={brand.url || "/catalog"} key={brand.id}>
                <img src={brand.logo} alt={brand.name} />
              </a>
            ))}
          </div>
          {canExpand ? (
            <button type="button" className="brands-expand" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
              {expanded ? (
                <>
                  Show fewer brands <ChevronUp size={16} />
                </>
              ) : (
                <>
                  Show all manufacturers <ChevronDown size={16} />
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

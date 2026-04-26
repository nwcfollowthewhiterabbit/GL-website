import { CheckCircle2, PackageCheck, ShieldCheck } from "lucide-react";
import { legacyAbout, legacyCatalogues, legacyLogoStrip, legacyManufacturers, legacyTopCategories } from "../data/legacyContent";

export function LegacyContentSection() {
  return (
    <section className="shell section legacy-section" id="about">
      <div className="section-heading">
        <div>
          <h2>Green Leaf supply model</h2>
          <p>{legacyAbout.intro}</p>
        </div>
      </div>

      <div className="legacy-layout">
        <article className="legacy-panel">
          <span className="legacy-panel__label">
            <ShieldCheck size={18} /> From the current site
          </span>
          <h3>Why customers buy from Green Leaf</h3>
          <ul className="legacy-list">
            {legacyAbout.promises.map((item) => (
              <li key={item}>
                <CheckCircle2 size={17} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="legacy-panel">
          <span className="legacy-panel__label">
            <PackageCheck size={18} /> Product scope
          </span>
          <h3>Operational categories</h3>
          <div className="legacy-chip-grid">
            {legacyAbout.productAreas.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </article>
      </div>

      <div className="legacy-category-band">
        <span>Old site top categories</span>
        <div>
          {legacyTopCategories.map((category) => (
            <strong key={category}>{category}</strong>
          ))}
        </div>
      </div>

      <div className="brand-strip" aria-label="Legacy brand logos">
        {legacyLogoStrip.map((brand) => (
          <div className="brand-strip__item" key={brand.name}>
            <img src={brand.image} alt={brand.name} />
          </div>
        ))}
      </div>

      <div className="legacy-meta">
        <span>{legacyManufacturers.length} manufacturers found in the old OpenCart site</span>
        <strong>{legacyAbout.serviceLine}</strong>
        <span>Legacy catalogues found: {legacyCatalogues.length}</span>
      </div>
    </section>
  );
}

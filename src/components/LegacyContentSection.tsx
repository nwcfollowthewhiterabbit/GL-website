import { CheckCircle2, PackageCheck, ShieldCheck, Sparkles } from "lucide-react";
import { legacyAbout, legacyLogoStrip, legacyManufacturers } from "../data/legacyContent";

export function LegacyContentSection() {
  return (
    <section className="shell section legacy-section" id="about">
      <div className="section-heading">
        <div>
          <h2>Built for hospitality operations.</h2>
          <p>{legacyAbout.intro}</p>
        </div>
      </div>

      <div className="legacy-layout">
        <article className="legacy-panel">
          <span className="legacy-panel__label">
            <ShieldCheck size={18} /> Supply promise
          </span>
          <h3>Service that fits trade buying</h3>
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
          <h3>Categories for hotels, restaurants and resorts</h3>
          <div className="legacy-chip-grid">
            {legacyAbout.productAreas.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </article>
      </div>

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

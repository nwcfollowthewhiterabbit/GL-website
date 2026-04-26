import { ArrowRight, Building2, CheckCircle2, Mail, PackageSearch, Search, Truck } from "lucide-react";
import { catalogStats, manufacturers } from "../data/catalog";
import { legacyBrand } from "../data/legacyContent";
import { productPlaceholder } from "../lib/catalog";

type HeroSectionProps = {
  catalogTotal: number | null;
  quoteCompany: string;
  quoteEmail: string;
  quoteStatus: string;
  isSubmitting: boolean;
  onCompanyChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onSubmitQuickQuote: () => void;
};

export function HeroSection({
  catalogTotal,
  quoteCompany,
  quoteEmail,
  quoteStatus,
  isSubmitting,
  onCompanyChange,
  onEmailChange,
  onSubmitQuickQuote
}: HeroSectionProps) {
  const heroProducts = [
    {
      label: "Housekeeping",
      image: "/api/files/Modern-Threads-100-Percent-Turkish-Cotton-Bath-Rug.webp"
    },
    {
      label: "Table service",
      image: "/api/files/mcuwc6bc12dt50cthzuq.avif"
    },
    {
      label: "Kitchen equipment",
      image: "/api/files/FCXGGD-0707S.png"
    }
  ];

  return (
    <section className="shell hero">
      <div className="hero__content">
        <span className="eyebrow">
          <Building2 size={16} /> B2B supply for hotels, restaurants and resorts
        </span>
        <h1>Hospitality supplies for Fiji operations.</h1>
        <p className="hero__copy">
          Browse commercial kitchen equipment, front-of-house serviceware, housekeeping supplies, furniture and
          eco-friendly consumables. Build a trade quote and let Green Leaf confirm price, stock and lead time.
        </p>
        <div className="hero__actions">
          <a className="primary-button" href="#catalog">
            Browse catalog <ArrowRight size={18} />
          </a>
          <a className="secondary-button" href="#contact">
            Contact sales
          </a>
        </div>
        <div className="quick-links">
          <span className="pill">
            <PackageSearch /> {(catalogTotal || catalogStats.erpnext.items).toLocaleString()} catalog items
          </span>
          <span className="pill">
            <Truck /> Trade quote workflow
          </span>
          <span className="pill">
            <CheckCircle2 /> {manufacturers.length}+ mapped brands
          </span>
          <span className="pill">
            <Mail /> {legacyBrand.email}
          </span>
        </div>
      </div>

      <aside className="hero__commerce">
        <div className="hero-showcase" aria-label="Product categories">
          {heroProducts.map((item) => (
            <figure key={item.label}>
              <img
                src={item.image}
                alt=""
                onError={(event) => {
                  event.currentTarget.src = productPlaceholder;
                }}
              />
              <figcaption>{item.label}</figcaption>
            </figure>
          ))}
        </div>
        <div className="quote-panel" aria-label="Fast quote form">
          <h2>Fast trade quote</h2>
          <p>Send your company details and start a quote request with Green Leaf sales.</p>
          <div className="field-grid">
            <label className="field">
              <Search size={18} />
              <input
                placeholder="Company name"
                value={quoteCompany}
                onChange={(event) => onCompanyChange(event.target.value)}
              />
            </label>
            <label className="field">
              <Mail size={18} />
              <input
                placeholder="Buyer email"
                type="email"
                value={quoteEmail}
                onChange={(event) => onEmailChange(event.target.value)}
              />
            </label>
            <button className="quote-button" onClick={onSubmitQuickQuote} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Request trade quote"} <ArrowRight size={18} />
            </button>
            {quoteStatus ? <p className="quote-panel__status">{quoteStatus}</p> : null}
          </div>
        </div>
      </aside>
    </section>
  );
}

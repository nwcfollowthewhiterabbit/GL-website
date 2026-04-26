import { ArrowRight, Building2, CheckCircle2, Factory, Mail, Search, Truck } from "lucide-react";
import { catalogStats, manufacturers } from "../data/catalog";

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
  return (
    <section className="shell hero">
      <div>
        <span className="eyebrow">
          <Building2 size={16} /> B2B supply for hotels, restaurants and resorts
        </span>
        <h1>Procurement storefront ready for ERPNext.</h1>
        <p className="hero__copy">
          A modern Green Leaf commerce concept with quote-led buying, product groups for hospitality operations, and a
          data structure prepared for two-way ERPNext synchronization.
        </p>
        <div className="quick-links">
          <span className="pill">
            <Truck /> {(catalogTotal || catalogStats.erpnext.items).toLocaleString()} ERP catalog items
          </span>
          <span className="pill">
            <Factory /> {catalogStats.erpnext.items.toLocaleString()} ERPNext items
          </span>
          <span className="pill">
            <CheckCircle2 /> {manufacturers.length}+ mapped brands
          </span>
        </div>
      </div>

      <aside className="quote-panel" aria-label="Fast quote form">
        <h2>Fast trade quote</h2>
        <p>Select a department and send a draft request. Later this can create a Sales Quotation in ERPNext.</p>
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
            {isSubmitting ? "Creating..." : "Build quotation"} <ArrowRight size={18} />
          </button>
          {quoteStatus ? <p className="quote-panel__status">{quoteStatus}</p> : null}
        </div>
      </aside>
    </section>
  );
}

import { ArrowRight, CheckCircle2, Mail, MapPin, Phone, ShieldCheck, Wrench } from "lucide-react";
import { legacyBrand } from "../data/legacyContent";

type ServiceContactSectionProps = {
  onOpenQuote: () => void;
};

export function ServiceContactSection({ onOpenQuote }: ServiceContactSectionProps) {
  return (
    <>
      <section className="shell section service-section" id="service">
        <div className="section-heading">
          <div>
            <h2>Service after the quote.</h2>
            <p>Green Leaf supports the operational side of hospitality supply, not only online product browsing.</p>
          </div>
        </div>
        <div className="service-grid">
          <article className="contact-card">
            <span className="service-icon">
              <ShieldCheck size={20} />
            </span>
            <h3>Warranty support</h3>
            <p>Service, spare parts and warranty support remain part of the buying process for equipment and fitouts.</p>
            <div className="contact-strip">
              <CheckCircle2 size={18} /> Best warranty on the market
            </div>
          </article>
          <article className="contact-card">
            <span className="service-icon">
              <Wrench size={20} />
            </span>
            <h3>Trade procurement</h3>
            <p>Use the catalog to shortlist products, then Green Leaf confirms availability, alternatives and lead time.</p>
            <div className="contact-strip">
              <CheckCircle2 size={18} /> Built around quote-led B2B buying
            </div>
          </article>
          <article className="contact-card" id="contact">
            <span className="service-icon">
              <MapPin size={20} />
            </span>
            <h3>Showroom and contact</h3>
            <p>Green Leaf Ltd, {legacyBrand.address}</p>
            <div className="contact-strip">
              <Phone size={18} /> {legacyBrand.phone}
              <Mail size={18} /> {legacyBrand.email}
            </div>
          </article>
        </div>
      </section>

      <section className="final-cta">
        <div className="shell final-cta__inner">
          <div>
            <span>Ready to source hospitality supplies?</span>
            <h2>Build a trade quote and let Green Leaf confirm the details.</h2>
          </div>
          <button className="primary-button" onClick={onOpenQuote}>
            Request quote <ArrowRight size={18} />
          </button>
        </div>
      </section>
    </>
  );
}

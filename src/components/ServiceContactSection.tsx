import { CheckCircle2, Mail, Phone } from "lucide-react";
import { legacyBrand } from "../data/legacyContent";

export function ServiceContactSection() {
  return (
    <section className="shell section contact" id="service">
      <article className="contact-card">
        <h3>Trade service model</h3>
        <p>
          Keep the visible shop simple while supporting the real B2B needs: quote approvals, customer-specific pricing,
          warranties, spare parts, and repeat purchase lists.
        </p>
        <div className="contact-strip">
          <CheckCircle2 size={18} /> Best warranty on the market
        </div>
      </article>
      <article className="contact-card" id="contact">
        <h3>Contact</h3>
          <p>Green Leaf Ltd, {legacyBrand.address}</p>
          <div className="contact-strip">
            <Phone size={18} /> {legacyBrand.phone}
            <Mail size={18} /> {legacyBrand.email}
          </div>
      </article>
    </section>
  );
}

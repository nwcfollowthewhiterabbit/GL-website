import { legacyBrand } from "../data/legacyContent";
import type { WebsiteCategory } from "../types";
import { PaymentTrustMarks } from "./PaymentTrustMarks";

type SiteFooterProps = {
  departments: WebsiteCategory[];
};

export function SiteFooter({ departments }: SiteFooterProps) {
  return (
    <footer className="footer">
      <div className="shell footer-layout">
        <div>
          <strong>Green Leaf Pacific</strong>
          <p>Hospitality supplies, furniture, equipment and service support for Fiji operations.</p>
          <p>{legacyBrand.legalName} · TIN {legacyBrand.tin}</p>
        </div>
        <div>
          <span>Departments</span>
          {departments.slice(0, 5).map((category) => (
            <a href={`/catalog/${category.id}`} key={category.id}>
              {category.label}
            </a>
          ))}
        </div>
        <div>
          <span>Company</span>
          <a href="/catalog#catalogs">Catalogues</a>
          <a href="/catalog#brands">Brands</a>
          <a href="/catalog#service">Service</a>
          <a href="/account">Account</a>
        </div>
        <div>
          <span>Policies</span>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/shipping">Shipping</a>
          <a href="/returns">Returns</a>
          <a href="/payment-security">Payment security</a>
        </div>
        <div>
          <span>Contact</span>
          <p>{legacyBrand.address}</p>
          <a href={`mailto:${legacyBrand.email}`}>{legacyBrand.email}</a>
          <a href={`tel:${legacyBrand.phone.replace(/\s+/g, "")}`}>{legacyBrand.phone}</a>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>{legacyBrand.legalName} trading as Green Leaf Pacific</span>
        <span>Prices exclude VAT · Currency FJD</span>
        <span className="footer-credit">Website created by <a href="https://rabbitsystems.net" target="_blank" rel="noreferrer">rabbitsystems.net</a></span>
      </div>
      <div className="shell footer-payment">
        <PaymentTrustMarks compact />
      </div>
    </footer>
  );
}

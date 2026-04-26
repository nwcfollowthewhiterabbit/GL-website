import { legacyBrand } from "../data/legacyContent";
import { websiteCategories } from "../data/websiteCategories";

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="shell footer-layout">
        <div>
          <strong>Green Leaf Pacific</strong>
          <p>Hospitality supplies, furniture, equipment and service support for Fiji operations.</p>
        </div>
        <div>
          <span>Departments</span>
          {websiteCategories.slice(0, 5).map((category) => (
            <a href={`/catalog/${category.id}`} key={category.id}>
              {category.label}
            </a>
          ))}
        </div>
        <div>
          <span>Company</span>
          <a href="/catalog#about">About</a>
          <a href="/catalog#brands">Brands</a>
          <a href="/catalog#service">Service</a>
          <a href="/account">Account</a>
        </div>
        <div>
          <span>Contact</span>
          <p>{legacyBrand.address}</p>
          <a href={`mailto:${legacyBrand.email}`}>{legacyBrand.email}</a>
          <a href={`tel:${legacyBrand.phone.replace(/\s+/g, "")}`}>{legacyBrand.phone}</a>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>Green Leaf Pacific storefront</span>
        <span>Trade quote catalog for hospitality procurement</span>
      </div>
    </footer>
  );
}

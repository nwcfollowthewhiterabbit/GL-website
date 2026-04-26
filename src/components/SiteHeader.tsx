import { ArrowRight, Mail, MapPin, Menu, Phone, ShoppingCart } from "lucide-react";
import { legacyBrand } from "../data/legacyContent";

type SiteHeaderProps = {
  quoteCount: number;
  onOpenQuote: () => void;
};

export function SiteHeader({ quoteCount, onOpenQuote }: SiteHeaderProps) {
  return (
    <>
      <div className="topbar">
        <div className="shell topbar__inner">
          <div className="topbar__group">
            <MapPin />
            <span>Nippon Complex Back Rd., Nadi, Fiji Islands</span>
          </div>
          <div className="topbar__group">
            <Phone />
            <span>+679 670 2222</span>
            <Mail />
            <span>buy@greenleafpacific.com</span>
          </div>
        </div>
      </div>

      <nav className="nav">
        <div className="shell nav__inner">
          <a className="brand" href="/catalog">
            <span className="brand__mark brand__mark--image">
              <img src={legacyBrand.logo} alt="" />
            </span>
            <span>
              <span className="brand__name">Green Leaf Pacific</span>
              <span className="brand__sub">Hospitality supply marketplace</span>
            </span>
          </a>
          <div className="nav__links">
            <a href="/catalog">Catalog</a>
            <a href="/catalog#about">About</a>
            <a href="/catalog#erp">ERPNext sync</a>
            <a href="/account">Account</a>
            <a href="/catalog#service">Service</a>
            <a href="/catalog#contact">Contact</a>
          </div>
          <div className="nav__actions">
            <button className="icon-button" aria-label="Open menu" title="Menu">
              <Menu />
            </button>
            <button className="icon-button" aria-label="Cart" title="Cart" onClick={onOpenQuote}>
              <ShoppingCart />
              {quoteCount ? <span className="cart-badge">{quoteCount}</span> : null}
            </button>
            <button className="primary-button" onClick={onOpenQuote}>
              Request quote <ArrowRight />
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}

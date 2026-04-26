import { useState } from "react";
import { ArrowRight, Mail, MapPin, Menu, Phone, ShoppingCart } from "lucide-react";
import { legacyBrand } from "../data/legacyContent";
import { websiteCategories } from "../data/websiteCategories";

type SiteHeaderProps = {
  quoteCount: number;
  onOpenQuote: () => void;
};

export function SiteHeader({ quoteCount, onOpenQuote }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

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
            <button
              type="button"
              className="nav__catalog-trigger"
              onClick={() => setMenuOpen((value) => !value)}
              aria-expanded={menuOpen}
            >
              Catalog
            </button>
            <a href="/catalog#brands">Brands</a>
            <a href="/catalog#service">Service</a>
            <a href="/catalog#about">About</a>
            <a href="/account">Account</a>
            <a href="/catalog#contact">Contact</a>
          </div>
          <div className="nav__actions">
            <button
              type="button"
              className="icon-button nav__menu-button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              title="Menu"
              onClick={() => setMenuOpen((value) => !value)}
            >
              <Menu />
            </button>
            <button type="button" className="icon-button" aria-label="Cart" title="Cart" onClick={onOpenQuote}>
              <ShoppingCart />
              {quoteCount ? <span className="cart-badge">{quoteCount}</span> : null}
            </button>
            <button type="button" className="primary-button" onClick={onOpenQuote}>
              Request quote <ArrowRight />
            </button>
          </div>
        </div>
        <div className={`shell nav-menu ${menuOpen ? "is-open" : ""}`}>
          <div className="nav-menu__main">
            <div>
              <span>Catalog departments</span>
              <strong>Shop by operation area</strong>
            </div>
            <a className="secondary-button" href="/catalog" onClick={closeMenu}>
              View all products
            </a>
          </div>
          <div className="nav-menu__departments">
            {websiteCategories.map((category) => (
              <a href={`/catalog/${category.id}`} key={category.id} onClick={closeMenu}>
                <span>{category.label}</span>
                <small>{category.description}</small>
              </a>
            ))}
          </div>
          <div className="nav-menu__links">
            <a href="/catalog#brands" onClick={closeMenu}>Brands</a>
            <a href="/catalog#service" onClick={closeMenu}>Service</a>
            <a href="/catalog#about" onClick={closeMenu}>About</a>
            <a href="/catalog#contact" onClick={closeMenu}>Contact</a>
            <a href="/account" onClick={closeMenu}>Account</a>
            <button type="button" onClick={() => { closeMenu(); onOpenQuote(); }}>Request quote</button>
          </div>
        </div>
      </nav>
    </>
  );
}

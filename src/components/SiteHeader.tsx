import { useEffect, useRef, useState } from "react";
import { ArrowRight, Mail, MapPin, Moon, Phone, ShoppingCart, Sun, UserRound } from "lucide-react";
import { legacyBrand } from "../data/legacyContent";
import type { ColorTheme } from "../hooks/useTheme";
import type { WebsiteCategory } from "../types";

type SiteHeaderProps = {
  departments: WebsiteCategory[];
  quoteCount: number;
  theme: ColorTheme;
  onToggleTheme: () => void;
  onOpenQuote: () => void;
};

export function SiteHeader({ departments, quoteCount, theme, onToggleTheme, onOpenQuote }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  function closeMenu() {
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!navRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("click", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("click", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <>
      <div className="topbar">
        <div className="shell topbar__inner">
          <div className="topbar__group">
            <MapPin />
            <span>{legacyBrand.address}</span>
          </div>
          <div className="topbar__group">
            <Phone />
            <span>+679 670 2222</span>
            <Mail />
            <span>buy@greenleafpacific.com</span>
          </div>
        </div>
      </div>

      <nav className="nav" ref={navRef}>
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
            <a href="/catalog#catalogs" onClick={closeMenu}>Catalogues</a>
            <a href="/catalog#brands" onClick={closeMenu}>Brands</a>
            <a href="/catalog#service" onClick={closeMenu}>Service</a>
            <a href="/account" onClick={closeMenu}>Account</a>
            <a href="/catalog#contact" onClick={closeMenu}>Contact</a>
          </div>
          <div className="nav__actions">
            <a
              className="icon-button nav__account-button"
              href="/account"
              aria-label="Customer account"
              title="Customer account"
              onClick={closeMenu}
            >
              <UserRound />
            </a>
            <button
              type="button"
              className="icon-button nav__theme-button"
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              aria-pressed={theme === "dark"}
              title={theme === "dark" ? "Light theme" : "Dark theme"}
              onClick={onToggleTheme}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </button>
            <button type="button" className="icon-button" aria-label="Cart" title="Cart" onClick={onOpenQuote}>
              <ShoppingCart />
              {quoteCount ? <span className="cart-badge">{quoteCount}</span> : null}
            </button>
            <button type="button" className="primary-button" onClick={onOpenQuote}>
              Order basket <ArrowRight />
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
            {departments.map((category) => (
              <a href={`/catalog/${category.id}`} key={category.id} onClick={closeMenu}>
                <span>{category.label}</span>
                <small>{category.description}</small>
              </a>
            ))}
          </div>
          <div className="nav-menu__links">
            <a href="/catalog#catalogs" onClick={closeMenu}>Catalogues</a>
            <a href="/catalog#brands" onClick={closeMenu}>Brands</a>
            <a href="/catalog#service" onClick={closeMenu}>Service</a>
            <a href="/catalog#contact" onClick={closeMenu}>Contact</a>
            <a href="/account" onClick={closeMenu}>Account</a>
            <button type="button" onClick={() => { closeMenu(); onOpenQuote(); }}>Order basket</button>
          </div>
        </div>
      </nav>
    </>
  );
}

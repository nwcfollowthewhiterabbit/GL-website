import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Mail, PackageSearch, Search, Truck } from "lucide-react";
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
  const heroSlides = [
    {
      label: "Iced tea program",
      title: "Beverage dispensers for hotel service.",
      copy: "Clickable legacy campaign adapted for the new ERP-backed catalog.",
      image: "/legacy/slider/iced3.jpg",
      href: "/catalog/coffee-iced-tea"
    },
    {
      label: "Trex decking",
      title: "Outdoor fitouts for Fiji resorts.",
      copy: "Decking and exterior hospitality spaces sourced through Green Leaf.",
      image: "/legacy/slider/trex.jpg",
      href: "/catalog/furniture-fitouts"
    },
    {
      label: "Karcher cleaning",
      title: "Wet season cleaning equipment.",
      copy: "Commercial cleaning lines mapped into the quote workflow.",
      image: "/legacy/slider/karcher_slider.jpg",
      href: "/catalog/housekeeping-cleaning"
    },
    {
      label: "Buffet solutions",
      title: "Buffet presentation for hotels and resorts.",
      copy: "Browse buffet display, serviceware and operational supply.",
      image: "/legacy/slider/buffet.jpg",
      href: "/catalog/buffet-table-service"
    }
  ];
  const [activeSlide, setActiveSlide] = useState(0);
  const slide = heroSlides[activeSlide];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((value) => (value + 1) % heroSlides.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  function previousSlide() {
    setActiveSlide((value) => (value - 1 + heroSlides.length) % heroSlides.length);
  }

  function nextSlide() {
    setActiveSlide((value) => (value + 1) % heroSlides.length);
  }

  return (
    <section className="shell hero">
      <div className="hero-slider" aria-label="Featured Green Leaf campaigns">
        <a className="hero-slide" href={slide.href}>
          <img
            src={slide.image}
            alt=""
            onError={(event) => {
              event.currentTarget.src = productPlaceholder;
            }}
          />
          <div className="hero-slide__overlay">
            <span className="eyebrow">
              <Building2 size={16} /> B2B supply for hotels, restaurants and resorts
            </span>
            <h1>{slide.title}</h1>
            <p className="hero__copy">{slide.copy}</p>
            <span className="primary-button">
              Open promotion <ArrowRight size={18} />
            </span>
          </div>
        </a>
        <div className="hero-slider__controls">
          <button type="button" className="icon-button" onClick={previousSlide} aria-label="Previous hero slide">
            <ArrowLeft />
          </button>
          <div className="hero-slider__dots" aria-label="Select hero slide">
            {heroSlides.map((item, index) => (
              <button
                type="button"
                className={activeSlide === index ? "is-active" : ""}
                key={item.label}
                onClick={() => setActiveSlide(index)}
                aria-label={`Show ${item.label}`}
              />
            ))}
          </div>
          <button type="button" className="icon-button" onClick={nextSlide} aria-label="Next hero slide">
            <ArrowRight />
          </button>
        </div>
      </div>

      <aside className="hero__side">
        <div className="hero-summary">
          <h2>Hospitality supplies for Fiji operations.</h2>
          <p>
            Browse commercial kitchen equipment, front-of-house serviceware, housekeeping supplies, furniture and
            eco-friendly consumables.
          </p>
          <div className="hero__actions">
            <a className="primary-button" href="#catalog">
              Browse catalog <ArrowRight size={18} />
            </a>
            <a className="secondary-button" href="#contact">
              Contact sales
            </a>
          </div>
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
      </aside>
    </section>
  );
}

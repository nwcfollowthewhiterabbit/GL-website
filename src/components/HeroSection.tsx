import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Building2 } from "lucide-react";
import { productPlaceholder } from "../lib/catalog";

export function HeroSection() {
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
    </section>
  );
}

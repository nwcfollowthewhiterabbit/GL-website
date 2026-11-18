import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { productPlaceholder } from "../lib/catalog";
import type { WebsiteBanner } from "../types";

// Responsive copies of the original campaign artwork shipped with this storefront.
const compactImages: Record<string, string> = {
  "/legacy/slider/iced3.jpg": "/legacy/slider/iced3-small.webp",
  "/legacy/slider/trex.jpg": "/legacy/slider/trex-small.webp",
  "/legacy/slider/karcher_slider.jpg": "/legacy/slider/karcher_slider-small.webp",
  "/legacy/slider/buffet.jpg": "/legacy/slider/buffet-small.webp"
};

type HeroSectionProps = {
  banners: WebsiteBanner[];
};

export function HeroSection({ banners }: HeroSectionProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const slide = banners[activeSlide] || banners[0];

  useEffect(() => {
    setActiveSlide(0);
  }, [banners]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveSlide((value) => (value + 1) % banners.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [banners.length]);

  function previousSlide() {
    setActiveSlide((value) => (value - 1 + banners.length) % banners.length);
  }

  function nextSlide() {
    setActiveSlide((value) => (value + 1) % banners.length);
  }

  if (!slide) return null;

  return (
    <section className="shell hero">
      <div className="hero-slider" aria-label="Featured Green Leaf campaigns">
        <a
          className="hero-slide"
          aria-label={[slide.title, slide.copy].filter(Boolean).join(" ")}
          href={slide.href || "/catalog"}
          target={slide.openInNewTab ? "_blank" : undefined}
          rel={slide.openInNewTab ? "noreferrer" : undefined}
        >
          <picture>
            {compactImages[slide.image] && <source media="(max-width: 980px)" srcSet={compactImages[slide.image]} />}
            <img src={slide.image} alt="" width={1920} height={500} fetchPriority="high"
              onError={(event) => {
                const image = event.currentTarget;
                const source = image.parentElement?.querySelector("source");
                if (source?.srcset) {
                  source.srcset = "";
                  return;
                }
                if (image.getAttribute("src") !== productPlaceholder) image.src = productPlaceholder;
              }}
            />
          </picture>
          <span className="hero-slide__caption">
            <strong>{slide.title}</strong>
            {slide.copy && <span>{slide.copy} <ArrowRight size={16} aria-hidden="true" /></span>}
          </span>
        </a>
        {banners.length > 1 ? (
          <div className="hero-slider__controls">
            <button type="button" className="icon-button" onClick={previousSlide} aria-label="Previous hero slide">
              <ArrowLeft />
            </button>
            <div className="hero-slider__dots" aria-label="Select hero slide">
              {banners.map((item, index) => (
                <button
                  type="button"
                  className={activeSlide === index ? "is-active" : ""}
                  key={item.id || item.label}
                  onClick={() => setActiveSlide(index)}
                  aria-label={`Show ${item.label || item.title}`}
                />
              ))}
            </div>
            <button type="button" className="icon-button" onClick={nextSlide} aria-label="Next hero slide">
              <ArrowRight />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { productPlaceholder } from "../lib/catalog";
import type { WebsiteBanner } from "../types";

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
          href={slide.href || "/catalog"}
          target={slide.openInNewTab ? "_blank" : undefined}
          rel={slide.openInNewTab ? "noreferrer" : undefined}
        >
          <img
            src={slide.image}
            alt=""
            onError={(event) => {
              event.currentTarget.src = productPlaceholder;
            }}
          />
          <div className="hero-slide__overlay">
            <h1>{slide.title}</h1>
            {slide.copy ? <p className="hero__copy">{slide.copy}</p> : null}
          </div>
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

import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";

type CatalogServiceBandProps = {
  onOpenQuote: () => void;
};

export function CatalogServiceBand({ onOpenQuote }: CatalogServiceBandProps) {
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let active = false;

    const updatePhotoOffset = () => {
      frame = 0;
      if (!active || motionQuery.matches) {
        section.style.setProperty("--service-photo-offset", "0px");
        return;
      }

      const rect = section.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const sectionCenter = rect.top + rect.height / 2;
      const offset = Math.max(-70, Math.min(70, (viewportCenter - sectionCenter) * 0.12));
      section.style.setProperty("--service-photo-offset", `${offset.toFixed(1)}px`);
    };

    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updatePhotoOffset);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        active = Boolean(entry?.isIntersecting);
        requestUpdate();
      },
      { rootMargin: "160px 0px" }
    );

    observer.observe(section);
    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    motionQuery.addEventListener("change", requestUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      motionQuery.removeEventListener("change", requestUpdate);
      section.style.removeProperty("--service-photo-offset");
    };
  }, []);

  return (
    <section className="catalog-service-band" aria-label="Green Leaf service workflow" ref={sectionRef}>
      <div className="shell catalog-service-band__inner">
        <span>One operational workflow</span>
        <h2>From catalog browsing to resort-ready supply planning.</h2>
        <p>
          Build a trade quote across kitchen equipment, buffet service, housekeeping, linen and fitout products. Green Leaf confirms price, stock and lead time from ERPNext.
        </p>
        <button type="button" className="catalog-service-band__button" onClick={onOpenQuote}>
          Request trade quote <ArrowRight size={18} />
        </button>
      </div>
    </section>
  );
}

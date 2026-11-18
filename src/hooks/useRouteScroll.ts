import { useLayoutEffect } from "react";
import type { StorefrontRoute } from "../lib/routes";

const catalogSections = new Set(["catalog", "brands", "service", "contact"]);

export function useRouteScroll(route: StorefrontRoute) {
  useLayoutEffect(() => {
    let stopTracking: (() => void) | undefined;

    function followLocation() {
      stopTracking?.();
      const fragment = window.location.hash.slice(1);
      const target = route.view === "catalog" && catalogSections.has(fragment)
        ? document.getElementById(fragment)
        : null;
      if (!target) {
        window.scrollTo({ top: 0, behavior: "instant" });
        return;
      }

      const header = document.querySelector<HTMLElement>(".nav");
      const alignSection = () => {
        target.style.scrollMarginTop = `${(header?.offsetHeight || 0) + 12}px`;
        target.scrollIntoView({ behavior: "instant", block: "start" });
      };

      // Product results, facets and recommendations can expand above this anchor.
      // Keep it in view until the visitor starts navigating independently.
      const sizes = new ResizeObserver(alignSection);
      sizes.observe(document.body);
      if (header) sizes.observe(header);
      const input = new AbortController();
      stopTracking = () => {
        sizes.disconnect();
        input.abort();
      };
      for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) {
        window.addEventListener(event, stopTracking, { passive: true, signal: input.signal });
      }
      target.focus({ preventScroll: true });
      alignSection();
    }

    followLocation();
    window.addEventListener("hashchange", followLocation);
    return () => {
      stopTracking?.();
      window.removeEventListener("hashchange", followLocation);
    };
  }, [route]);
}

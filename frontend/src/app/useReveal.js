import { useEffect } from "react";

/*
 * Scroll reveals that replay in both directions. Any element with
 * data-reveal ("up" default, "left", "right", "scale", "tilt") eases in each
 * time it enters the screen and eases back out when it leaves. Elements that
 * leave past the top come back in from above when you scroll up again, so
 * the motion always follows your scroll. Transform and opacity only.
 * Pass `key` to pick up elements that mount later (the results).
 */
export function useReveal(key) {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll("[data-reveal]"));
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") {
      items.forEach((el) => el.classList.add("is-in"));
      return undefined;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const el = e.target;
        if (e.isIntersecting) {
          el.classList.add("is-in");
        } else {
          const above = e.boundingClientRect.top < (e.rootBounds?.top ?? 0);
          el.classList.toggle("from-above", above);
          el.classList.remove("is-in");
        }
      });
    }, { rootMargin: "-6% 0px -8% 0px", threshold: 0 });
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [key]);
}

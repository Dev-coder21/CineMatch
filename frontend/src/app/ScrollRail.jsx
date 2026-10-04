import { useEffect, useRef } from "react";

/*
 * CineMatch's own scrollbar: a thin film-edge rail fixed to the right of the
 * screen, mapping the whole page (not its sections). Drag the pink thumb to
 * scrub anywhere, or click any point on the rail to travel there. A small
 * readout shows how far down the page you are while you move.
 * Updates write straight to the DOM in one animation frame, so it never
 * re-renders React while scrolling.
 */
export default function ScrollRail({ hidden = false }) {
  const rail = useRef(null);
  const thumb = useRef(null);
  const readout = useRef(null);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("cm-has-rail");
    return () => root.classList.remove("cm-has-rail");
  }, []);

  useEffect(() => {
    const railEl = rail.current, thumbEl = thumb.current, readEl = readout.current;
    if (!railEl || !thumbEl) return undefined;
    let raf = 0, thumbH = 40, trackH = 1, dragging = null, hideTimer = 0;

    const max = () => Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const measure = () => {
      trackH = railEl.clientHeight;
      const ratio = Math.min(1, window.innerHeight / document.documentElement.scrollHeight);
      thumbH = Math.max(36, Math.round(trackH * ratio));
      thumbEl.style.height = `${thumbH}px`;
      railEl.classList.toggle("is-flat", ratio >= 0.999);
    };
    const paint = () => {
      raf = 0;
      const p = Math.min(1, Math.max(0, window.scrollY / max()));
      const y = p * (trackH - thumbH);
      thumbEl.style.transform = `translate3d(0, ${y}px, 0)`;
      if (readEl) {
        readEl.style.transform = `translate3d(0, ${y + thumbH / 2}px, 0)`;
        readEl.textContent = `${String(Math.round(p * 100)).padStart(2, "0")}%`;
      }
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); };
    const awake = () => {
      railEl.classList.add("is-active");
      clearTimeout(hideTimer);
      if (!dragging) hideTimer = setTimeout(() => railEl.classList.remove("is-active"), 900);
    };
    const onScroll = () => { schedule(); awake(); };

    const scrollToY = (clientY, smooth) => {
      const box = railEl.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (clientY - box.top - thumbH / 2) / (trackH - thumbH)));
      window.scrollTo({ top: p * max(), behavior: smooth ? "smooth" : "auto" });
    };

    const down = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      if (e.target === thumbEl) {
        const box = thumbEl.getBoundingClientRect();
        dragging = { offset: e.clientY - box.top };
        railEl.classList.add("is-dragging");
        railEl.setPointerCapture(e.pointerId);
      } else {
        scrollToY(e.clientY, true);
      }
      awake();
    };
    const move = (e) => {
      if (!dragging) return;
      scrollToY(e.clientY - dragging.offset + thumbH / 2, false);
    };
    const up = (e) => {
      if (!dragging) return;
      dragging = null;
      railEl.classList.remove("is-dragging");
      try { railEl.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      awake();
    };

    measure(); paint();
    const ro = new ResizeObserver(() => { measure(); schedule(); });
    ro.observe(document.body);
    ro.observe(railEl);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    railEl.addEventListener("pointerdown", down);
    railEl.addEventListener("pointermove", move);
    railEl.addEventListener("pointerup", up);
    railEl.addEventListener("pointercancel", up);
    return () => {
      cancelAnimationFrame(raf); clearTimeout(hideTimer); ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      railEl.removeEventListener("pointerdown", down);
      railEl.removeEventListener("pointermove", move);
      railEl.removeEventListener("pointerup", up);
      railEl.removeEventListener("pointercancel", up);
    };
  }, []);

  return (
    <div ref={rail} className={`bc-rail${hidden ? " is-hidden" : ""}`} aria-hidden="true">
      <span className="bc-rail__track" />
      <span ref={thumb} className="bc-rail__thumb" />
      <span ref={readout} className="bc-rail__readout">00%</span>
    </div>
  );
}

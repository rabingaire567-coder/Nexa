import { useEffect, useRef, useState } from 'react';
import { useReducedMotionPref } from './useMotion';

/**
 * Adds `is-in` once the element scrolls into view.
 *
 * The threshold defaults to 0 on purpose: a section taller than the viewport
 * can never become 16% "visible" as a fraction of itself, so a fractional
 * threshold would leave tall sections permanently hidden.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(threshold = 0) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setInView(true);
      },
      { threshold, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, inView };
}

export function useCountUp(target: number, active: boolean, duration = 1500) {
  const reduced = useReducedMotionPref();
  const [v, setV] = useState(active ? 0 : target);

  useEffect(() => {
    if (!active) return;
    if (reduced) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - (1 - p) ** 3;
      setV(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration, reduced]);

  return v;
}

/** Tracks a media query. */
export function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia(query).matches));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/** Pointer position within an element, for tilt and spotlight effects. */
export function usePointer<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      setPos({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
    };
    const leave = () => setPos({ x: 0.5, y: 0.5 });
    el.addEventListener('pointermove', on);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', on);
      el.removeEventListener('pointerleave', leave);
    };
  }, []);

  return { ref, pos };
}

/** Rolling window of recent timestamps — drives the live activity ticker. */
export function useTicker(intervalMs = 4000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

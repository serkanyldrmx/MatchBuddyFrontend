import { useEffect, useRef, useState } from 'react';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Öğe görünür alana girdi mi (bir kez true olur) */
export function useInView(options = { threshold: 0.25 }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return undefined;
    if (!('IntersectionObserver' in window)) {
      setInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        io.disconnect();
      }
    }, options);
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);
  return [ref, inView];
}

/** Sayıyı hedef değere yumuşakça taşır (start true olunca başlar) */
export function useCountUp(target, start = true, duration = 900) {
  const [value, setValue] = useState(start && prefersReducedMotion() ? target : 0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (!start) return undefined;
    if (prefersReducedMotion()) {
      setValue(target);
      return undefined;
    }
    const from = fromRef.current;
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = from + (target - from) * eased;
      setValue(v);
      fromRef.current = v;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, start, duration]);
  return value;
}

/**
 * Sayfadaki [data-reveal] öğelerine görünür olunca "is-in" sınıfı ekler.
 * Sonradan eklenen öğeler (sekme değişimi vb.) de MutationObserver ile yakalanır.
 */
export function useRevealAll(rootRef, dep) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const instant = prefersReducedMotion() || !('IntersectionObserver' in window);
    const io = instant
      ? null
      : new IntersectionObserver(
          (entries) =>
            entries.forEach((e) => {
              if (e.isIntersecting) {
                e.target.classList.add('is-in');
                io.unobserve(e.target);
              }
            }),
          { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
        );
    const watch = (scope) => {
      const list = scope.matches?.('[data-reveal]') ? [scope] : [];
      scope.querySelectorAll?.('[data-reveal]:not(.is-in)').forEach((el) => list.push(el));
      list.forEach((el) => (instant ? el.classList.add('is-in') : io.observe(el)));
    };
    watch(root);
    const mo =
      'MutationObserver' in window
        ? new MutationObserver((muts) =>
            muts.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && watch(n)))
          )
        : null;
    mo?.observe(root, { childList: true, subtree: true });
    return () => {
      io?.disconnect();
      mo?.disconnect();
    };
  }, [rootRef, dep]);
}

/** Görünür alanda mı (sürekli izler; animasyonları ekran dışında durdurmak için) */
export function useVisible(ref, rootMargin = '0px') {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) {
      setVisible(true);
      return undefined;
    }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return visible;
}

export const formatTRY = (n) => `${Math.round(n).toLocaleString('tr-TR')} ₺`;

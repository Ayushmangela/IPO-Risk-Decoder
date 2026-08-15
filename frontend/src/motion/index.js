/**
 * Motion primitives — the single place GSAP is touched.
 *
 * Everything here obeys the interaction thesis in MASTER.md: fast, dry,
 * engineered. No bounce, no elastic, no spring overshoot, nothing above
 * 320ms, and motion only where it communicates hierarchy or state. Feature
 * components import these hooks; they never import gsap directly, so the
 * timing/easing rules stay enforceable in one file.
 *
 * Every hook is a no-op under prefers-reduced-motion: the element lands in
 * its final state immediately rather than animating. State still changes,
 * it just doesn't move.
 */

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

/** Duration tokens, mirroring tokens.css. Entrance is allowed to run longer
 *  than a hover (which is 140ms) because it covers real layout distance. */
export const DUR = {
  fast: 0.14,
  move: 0.18,
  entrance: 0.32,
  count: 0.5,
};

export const EASE = {
  out: 'power2.out',
  move: 'power3.out',
};

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Live-updating reduced-motion flag (users can toggle the OS setting mid-session). */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/**
 * Staggered entrance for a container's direct children.
 *
 * Communicates reading order — the verdict resolves before the supporting
 * panels beneath it — rather than decorating. Deliberately small distance
 * (8px) and short stagger (40ms): a dashboard the user reloads all day
 * should never feel like it's performing for them.
 *
 * `key` re-runs the entrance when it changes (e.g. switching company), so
 * the new filing's numbers read as genuinely new rather than silently
 * swapping in place.
 */
export function useStaggerEntrance(key) {
  const containerRef = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const children = Array.from(el.children);
    if (children.length === 0) return undefined;

    if (reduced) {
      gsap.set(children, { clearProps: 'all' });
      return undefined;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        children,
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: DUR.entrance,
          ease: EASE.out,
          stagger: 0.04,
          clearProps: 'transform',
        }
      );
    }, el);

    return () => ctx.revert();
  }, [key, reduced]);

  return containerRef;
}

/**
 * Counts a number up to its target.
 *
 * Financial numbers changing silently is a real readability problem when
 * switching between filings — the count-up marks "this value just changed"
 * without a flash or highlight. Returns a ref to attach to the element
 * whose textContent should be driven.
 *
 * `format` keeps the caller in charge of decimals/units so this never
 * invents a number format the rest of the app doesn't use.
 */
export function useCountUp(value, format = (v) => String(v)) {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const target = Number(value);
    if (!Number.isFinite(target)) {
      el.textContent = format(value);
      return undefined;
    }

    if (reduced) {
      el.textContent = format(target);
      return undefined;
    }

    const counter = { v: 0 };
    const tween = gsap.to(counter, {
      v: target,
      duration: DUR.count,
      ease: EASE.out,
      onUpdate: () => {
        el.textContent = format(counter.v);
      },
      onComplete: () => {
        // Snap to the exact target — never leave a rounding artifact of the
        // tween as the final displayed financial figure.
        el.textContent = format(target);
      },
    });

    return () => tween.kill();
  }, [value, format, reduced]);

  return ref;
}

/**
 * Mount/unmount transition for overlay surfaces (command palette).
 *
 * Returns `mounted` (should the component render at all) and a ref for the
 * panel. Keeps the element in the DOM long enough to play its exit, which
 * the old `if (!open) return null` hard-cut couldn't do.
 */
export function useOverlayTransition(open) {
  const panelRef = useRef(null);
  const overlayRef = useRef(null);
  const [mounted, setMounted] = useState(open);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    const panel = panelRef.current;
    const overlay = overlayRef.current;
    if (!mounted || !panel) return undefined;

    if (reduced) {
      if (!open) setMounted(false);
      return undefined;
    }

    let fallbackId;

    const ctx = gsap.context(() => {
      if (open) {
        gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: DUR.fast, ease: EASE.out });
        gsap.fromTo(
          panel,
          { opacity: 0, y: -6 },
          { opacity: 1, y: 0, duration: DUR.move, ease: EASE.move, clearProps: 'transform' }
        );
      } else {
        gsap.to(overlay, { opacity: 0, duration: DUR.fast, ease: EASE.out });
        gsap.to(panel, {
          opacity: 0,
          y: -6,
          duration: DUR.fast,
          ease: EASE.out,
          onComplete: () => setMounted(false),
        });

        // Unmount must never depend solely on the tween finishing. GSAP is
        // rAF-driven, and rAF is paused in a backgrounded/hidden tab — so a
        // close fired just before the tab is hidden would otherwise leave the
        // overlay mounted indefinitely, covering the whole app with an
        // invisible click-blocking layer. This timer guarantees teardown.
        fallbackId = setTimeout(() => setMounted(false), DUR.fast * 1000 + 120);
      }
    });

    return () => {
      if (fallbackId) clearTimeout(fallbackId);
      ctx.revert();
    };
  }, [open, mounted, reduced]);

  return { mounted, panelRef, overlayRef };
}

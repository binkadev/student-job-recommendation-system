import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { RefObject } from "react";

gsap.registerPlugin(useGSAP);

/**
 * Subtle GPU-only (transform + opacity) route transition for NOVA MOTION shells.
 * Respects prefers-reduced-motion and clears inline properties after completion.
 */
export function useNovaLayoutMotion(containerRef: RefObject<HTMLElement | null>, triggerKey: string) {
  useGSAP(
    () => {
      const root = containerRef.current;
      if (!root) return;

      const prefersReduced =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReduced) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          root,
          { opacity: 0.92, y: 6 },
          {
            opacity: 1,
            y: 0,
            duration: 0.2,
            ease: "power2.out",
            clearProps: "transform,opacity",
          },
        );
      });

      return () => mm.revert();
    },
    { scope: containerRef, dependencies: [triggerKey] },
  );
}

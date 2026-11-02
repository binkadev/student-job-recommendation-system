import { useEffect, useRef } from "react";

interface SplitTextProps {
  text: string;
  className?: string;
}

let runtime: Promise<[typeof import("gsap"), typeof import("gsap/SplitText")]> | undefined;
function loadRuntime() {
  runtime ??= Promise.all([import("gsap"), import("gsap/SplitText")]).catch((error) => {
    runtime = undefined;
    throw error;
  });
  return runtime;
}

// Adapted from the installed React Bits SplitText for a single Hero entrance.
// Render real, visible heading text before loading any animation code.
export default function SplitText({ text, className }: SplitTextProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const playedText = useRef<string | null>(null);

  useEffect(() => {
    const element = ref.current;
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!element || !motion || motion.matches || playedText.current === text) return;

    let cancelled = false;
    let started = false;
    let context: gsap.Context | undefined;
    let split: import("gsap/SplitText").SplitText | undefined;

    const revert = () => {
      context?.revert();
      split?.revert();
      context = undefined;
      split = undefined;
    };

    const start = async () => {
      if (started) return;
      started = true;
      try {
        // Keep GSAP out of the initial bundle and routes without this heading.
        const [[{ gsap }, { SplitText: GSAPSplitText }]] = await Promise.all([
          loadRuntime(),
          document.fonts?.ready,
        ]);
        if (cancelled || motion.matches || !element.isConnected) return;
        const bounds = element.getBoundingClientRect();
        if (bounds.bottom <= 0 || bounds.top >= window.innerHeight) return;

        gsap.registerPlugin(GSAPSplitText);
        // A scoped context is used instead of a statically imported useGSAP hook
        // so reduced-motion users never need to download the animation runtime.
        context = gsap.context(() => {
          split = new GSAPSplitText(element, {
            type: "words",
            aria: "auto",
            reduceWhiteSpace: false,
          });
          playedText.current = text;
          gsap.from(split.words, {
            opacity: 0.65,
            y: 8,
            duration: 0.45,
            stagger: { amount: 0.18 },
            ease: "power2.out",
            onComplete: () => split?.revert(),
          });
        }, element);
      } catch {
        // Animation is optional: retain readable text if its chunk cannot load.
        revert();
      }
    };

    const observer = typeof IntersectionObserver === "undefined" ? undefined : new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer?.disconnect();
        void start();
      }
    });
    if (observer) observer.observe(element);
    else void start();

    const onMotionChange = () => {
      if (motion.matches) {
        cancelled = true;
        observer?.disconnect();
        revert();
      }
    };
    motion.addEventListener("change", onMotionChange);

    return () => {
      cancelled = true;
      observer?.disconnect();
      motion.removeEventListener("change", onMotionChange);
      revert();
    };
  }, [text]);

  return <h1 ref={ref} className={className}>{text}</h1>;
}

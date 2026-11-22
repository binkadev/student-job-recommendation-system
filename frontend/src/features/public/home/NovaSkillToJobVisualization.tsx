import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ArrowUpRight, Cpu, FileCode, Sparkles, Building2, CheckCircle2 } from "lucide-react";

export function NovaSkillToJobVisualization() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cvCardRef = useRef<HTMLDivElement>(null);
  const jobCardRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<HTMLDivElement>(null);
  const pulseRingRef = useRef<HTMLDivElement>(null);
  const particle1Ref = useRef<SVGCircleElement>(null);
  const particle2Ref = useRef<SVGCircleElement>(null);

  useGSAP(
    () => {
      // Check environment and prefers-reduced-motion
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion) {
        return;
      }

      // Entrance animation timeline
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.fromTo(
        engineRef.current,
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.8, delay: 0.2 }
      )
        .fromTo(
          cvCardRef.current,
          { x: -30, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.7 },
          "-=0.5"
        )
        .fromTo(
          jobCardRef.current,
          { x: 30, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.7 },
          "-=0.5"
        );

      // Only run ambient float and particle anim on tablet/desktop to save mobile CPU/battery
      if (window.innerWidth < 640) {
        return () => {
          tl.kill();
        };
      }

      // Ambient gentle floating motion (transform only, 60fps)
      const floatCv = gsap.to(cvCardRef.current, {
        y: -6,
        duration: 3,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      const floatJob = gsap.to(jobCardRef.current, {
        y: 6,
        duration: 3.4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 0.5,
      });

      // Pulse ring scaling
      const pulseAnim = gsap.to(pulseRingRef.current, {
        scale: 1.14,
        opacity: 0.2,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      // SVG particles traveling along connections
      let p1Anim: gsap.core.Tween | null = null;
      let p2Anim: gsap.core.Tween | null = null;

      if (particle1Ref.current) {
        p1Anim = gsap.to(particle1Ref.current, {
          cx: 245,
          cy: 135,
          duration: 2.2,
          repeat: -1,
          ease: "power1.inOut",
        });
      }

      if (particle2Ref.current) {
        p2Anim = gsap.to(particle2Ref.current, {
          cx: 190,
          cy: 260,
          duration: 2.4,
          repeat: -1,
          ease: "power1.inOut",
          delay: 0.6,
        });
      }

      return () => {
        tl.kill();
        floatCv.kill();
        floatJob.kill();
        pulseAnim.kill();
        p1Anim?.kill();
        p2Anim?.kill();
      };
    },
    { scope: containerRef }
  );

  return (
    <div
      ref={containerRef}
      className="nova-vis-container"
      aria-label="Minh họa trực quan quy trình đối sánh kỹ năng và việc làm IT"
    >
      {/* SVG Connecting Flow Lines */}
      <svg
        className="nova-vis-svg pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 480 380"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="flowGrad1" x1="180" y1="80" x2="250" y2="140" gradientUnits="userSpaceOnUse">
            <stop stopColor="#237D70" stopOpacity="0.8" />
            <stop offset="1" stopColor="#D5F36A" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="flowGrad2" x1="290" y1="190" x2="200" y2="260" gradientUnits="userSpaceOnUse">
            <stop stopColor="#D5F36A" stopOpacity="0.9" />
            <stop offset="1" stopColor="#FF7956" stopOpacity="0.7" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Path 1: From CV card to Engine Core */}
        <path
          d="M 190 85 C 215 95, 225 120, 245 135"
          stroke="url(#flowGrad1)"
          strokeWidth="2"
          strokeDasharray="4 4"
          opacity="0.8"
        />

        {/* Path 2: From Engine Core to Job Card */}
        <path
          d="M 270 205 C 250 230, 230 245, 190 260"
          stroke="url(#flowGrad2)"
          strokeWidth="2"
          strokeDasharray="4 4"
          opacity="0.8"
        />

        {/* Animated Particles */}
        <circle ref={particle1Ref} cx="190" cy="85" r="3.5" fill="#D5F36A" filter="url(#glow)" />
        <circle ref={particle2Ref} cx="270" cy="205" r="3.5" fill="#FF7956" filter="url(#glow)" />
      </svg>

      {/* Floating CV Node Card (Top-Left) */}
      <div ref={cvCardRef} className="nova-vis-card nova-vis-card-cv">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#237d70]/20 text-[#78d2c3]">
              <FileCode size={15} />
            </span>
            <span className="text-xs font-bold text-white tracking-wide">CV Sinh Viên IT</span>
          </div>
          <span className="nova-vis-badge nova-vis-badge-lime whitespace-nowrap text-[10px]">Đã xử lý</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="nova-vis-badge">React</span>
          <span className="nova-vis-badge">TypeScript</span>
          <span className="nova-vis-badge">Spring Boot</span>
          <span className="nova-vis-badge">PostgreSQL</span>
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#9bb0c9]">
          <CheckCircle2 size={12} className="text-[#d5f36a]" />
          <span>Phân tích NLP tiếng Anh</span>
        </div>
      </div>

      {/* Central Matching Engine Core */}
      <div ref={engineRef} className="nova-vis-card-engine">
        <div ref={pulseRingRef} className="nova-pulse-ring" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#237d70]/30 text-[#d5f36a]">
            <Cpu size={18} />
          </div>
          <span className="mt-1 text-[11px] font-bold tracking-tight text-white">TF-IDF & Cosine</span>
          <span className="text-[10px] font-semibold text-[#d5f36a]">Match: 95%</span>
        </div>
      </div>

      {/* Floating Job Node Card (Bottom-Right) */}
      <div ref={jobCardRef} className="nova-vis-card nova-vis-card-job">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ff7956]/20 text-[#ff7956]">
              <Building2 size={15} />
            </span>
            <div className="min-w-0">
              <span className="block truncate text-xs font-bold text-white">Fullstack Developer</span>
              <span className="block truncate text-[10px] text-[#9bb0c9]">VNG · TP. Hồ Chí Minh</span>
            </div>
          </div>
          <span className="nova-vis-badge nova-vis-badge-lime text-[10px]">
            <ArrowUpRight size={11} /> 95%
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="nova-vis-badge nova-vis-badge-lime">React (100%)</span>
          <span className="nova-vis-badge nova-vis-badge-lime">Spring (100%)</span>
          <span className="nova-vis-badge nova-vis-badge-coral">Docker (Thiếu)</span>
        </div>

        <div className="mt-2 text-right">
          <span className="text-[10px] font-medium text-[#78d2c3]">Độ tương đồng cao</span>
        </div>
      </div>

      {/* Caption at bottom */}
      <div className="nova-vis-caption">
        <Sparkles size={13} className="text-[#d5f36a] shrink-0" />
        <span>Đối sánh thông minh theo độ tương đồng ngữ nghĩa và kỹ năng cốt lõi</span>
      </div>
    </div>
  );
}

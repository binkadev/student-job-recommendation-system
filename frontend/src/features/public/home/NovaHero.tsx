import { useRef } from "react";
import { Link } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ArrowRight, Building2, FileText, Sparkles } from "lucide-react";
import { NovaSkillToJobVisualization } from "./NovaSkillToJobVisualization";

interface NovaHeroProps {
  isAuthenticated: boolean;
  currentRole: string | null;
}

export function NovaHero({ isAuthenticated, currentRole }: NovaHeroProps) {
  const heroRef = useRef<HTMLElement>(null);
  const textContentRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion) return;

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.from(".nova-eyebrow", {
        y: -15,
        opacity: 0,
        duration: 0.6,
      })
        .from(
          ".nova-hero-title-line",
          {
            y: 35,
            opacity: 0,
            duration: 0.8,
            stagger: 0.15,
          },
          "-=0.3"
        )
        .from(
          ".nova-hero-desc",
          {
            y: 20,
            opacity: 0,
            duration: 0.6,
          },
          "-=0.4"
        )
        .from(
          ".nova-cta-group",
          {
            y: 20,
            opacity: 0,
            duration: 0.6,
          },
          "-=0.4"
        )
        .from(
          ".nova-tech-tagline",
          {
            opacity: 0,
            duration: 0.5,
          },
          "-=0.3"
        );
    },
    { scope: heroRef }
  );

  return (
    <section
      ref={heroRef}
      className="nova-hero"
      aria-label="Giới thiệu hệ thống gợi ý việc làm IT Nova Motion"
    >
      <div className="nova-hero-grid">
        {/* Left Column: Staggered Cinematic Typography */}
        <div ref={textContentRef} className="z-10">
          <div className="nova-eyebrow">
            <span className="nova-eyebrow-badge" />
            <FileText size={14} className="text-[#d5f36a]" aria-hidden="true" />
            <span>NỀN TẢNG ĐỐI SÁNH VIỆC LÀM IT THÔNG MINH</span>
          </div>

          <h1 className="nova-hero-title">
            <span className="nova-hero-title-line block">Kỹ năng của bạn.</span>
            <span className="nova-hero-title-line nova-text-gradient block">
              Khởi đầu xứng đáng.
            </span>
          </h1>

          <p className="nova-hero-description nova-hero-desc">
            Biến nội dung CV thành cơ hội nghề nghiệp tương thích cao. Khám phá khoảng trống kỹ năng, minh bạch lý do gợi ý với công nghệ TF-IDF và Cosine Similarity cho CV tiếng Anh chuẩn hóa.
          </p>

          <div className="nova-cta-group mt-8 flex flex-wrap items-center gap-3.5">
            <Link
              to={
                isAuthenticated && currentRole === "candidate"
                  ? "/candidate/jobs/recommended"
                  : "/register/candidate"
              }
              className="nova-btn-primary"
            >
              <span>Tôi là sinh viên</span>
              <ArrowRight size={17} aria-hidden="true" />
            </Link>

            <Link
              to={
                isAuthenticated && currentRole === "recruiter"
                  ? "/recruiter/dashboard"
                  : "/register/recruiter"
              }
              className="nova-btn-secondary"
            >
              <Building2 size={17} className="text-[#78d2c3]" aria-hidden="true" />
              <span>Tôi là doanh nghiệp</span>
            </Link>
          </div>

          <div className="nova-tech-tagline mt-6 flex items-center gap-2 text-xs font-medium text-[#9bb0c9]">
            <Sparkles size={14} className="text-[#d5f36a]" />
            <span>Thuật toán TF-IDF · Cosine Similarity cho CV tiếng Anh · Xếp hạng V3 phân tầng</span>
          </div>
        </div>

        {/* Right Column: Layered Floating UI & Skill-to-Job Visualization */}
        <div className="z-10">
          <NovaSkillToJobVisualization />
        </div>
      </div>
    </section>
  );
}

import { BriefcaseBusiness, Building2, FileText, Users, ArrowUpRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "../../../components/ui/Button";
import type { HomeData } from "./homeTypes";
import gsap from "gsap";

interface NovaPlatformMetricsProps {
  statistics: HomeData["statistics"];
  loading: boolean;
  error: boolean;
  statisticsUnavailable: boolean;
  onRetry: () => void;
}

const metricIcons = [
  { icon: BriefcaseBusiness, color: "#237D70", labelColor: "text-[#237D70]", bg: "bg-[#237D70]/10" },
  { icon: Users, color: "#D5F36A", labelColor: "text-[#134B43]", bg: "bg-[#D5F36A]/20" },
  { icon: Building2, color: "#FF7956", labelColor: "text-[#FF7956]", bg: "bg-[#FF7956]/15" },
  { icon: FileText, color: "#237D70", labelColor: "text-[#237D70]", bg: "bg-[#237D70]/10" },
];

export function NovaPlatformMetrics({
  statistics,
  loading,
  error,
  statisticsUnavailable,
  onRetry,
}: NovaPlatformMetricsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || loading || error) return;

    const cards = containerRef.current?.querySelectorAll(".nova-metric-card");
    if (!cards || cards.length === 0) return;

    let ctx: gsap.Context | null = null;

    // Dynamically register and run ScrollTrigger only in browser environment
    import("gsap/ScrollTrigger").then(({ ScrollTrigger }) => {
      if (typeof window.matchMedia === "function") {
        gsap.registerPlugin(ScrollTrigger);
      }
      ctx = gsap.context(() => {
        gsap.fromTo(
          cards,
          { y: 20, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            stagger: 0.12,
            ease: "power2.out",
            scrollTrigger: {
              trigger: containerRef.current,
              start: "top 85%",
              once: true,
            },
          }
        );
      }, containerRef);
    }).catch(() => {
      // Fallback: simple fade in without ScrollTrigger
      ctx = gsap.context(() => {
        gsap.fromTo(cards, { opacity: 0 }, { opacity: 1, duration: 0.4 });
      }, containerRef);
    });

    return () => {
      ctx?.revert();
    };
  }, [loading, error]);

  return (
    <div className="mt-8">
      <section
        ref={containerRef}
        aria-label="Thống kê công khai"
        className="nova-metrics-grid"
      >
        {statistics.map((item, index) => {
          const config = metricIcons[index] ?? metricIcons[0];
          const Icon = config.icon;

          return (
            <div
              key={item.id}
              className="nova-metric-card"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${config.bg} ${config.labelColor}`}>
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  <p className="text-sm font-semibold text-[#1b2533]">{item.label}</p>
                </div>
                <ArrowUpRight size={16} className="text-[#9bb0c9] transition hover:text-[#0c111c]" aria-hidden="true" />
              </div>

              <div className="mt-3 flex min-h-[36px] items-center">
                {loading ? (
                  <span role="status" className="block text-sm font-medium text-slate-500">
                    Đang tải số liệu…
                  </span>
                ) : !error && item.value != null ? (
                  <strong className="nova-metric-number !mt-0 block">
                    {item.value}
                  </strong>
                ) : (
                  <span className="block text-sm text-slate-600">
                    {error ? "Không tải được số liệu" : item.unavailableReason ?? "Chưa có số liệu"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {statisticsUnavailable ? (
        <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
          <span>Không tải được thống kê công khai. Số liệu hiện chưa xác định.</span>
          <Button variant="ghost" size="sm" onClick={onRetry}>
            Thử lại thống kê
          </Button>
        </div>
      ) : null}
    </div>
  );
}

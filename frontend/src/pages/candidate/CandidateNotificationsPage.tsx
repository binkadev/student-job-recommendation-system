import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Bell, FolderKanban, Sparkles } from "lucide-react";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { Button } from "../../components/ui/Button";
import { NotificationsPanel } from "../../features/account/NotificationsPanel";
import { useAuth } from "../../hooks/useAuth";
import { AUTH_TOKEN_STORAGE_KEY } from "../../services/api/httpClient";

export function CandidateNotificationsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentUser } = useAuth();

  useGSAP(
    () => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (!containerRef.current) return;

      gsap.fromTo(
        ".nm-reveal",
        { opacity: 0, y: 16 },
        {
          opacity: 1,
          y: 0,
          duration: 0.45,
          stagger: 0.05,
          ease: "power2.out",
        },
      );
    },
    { scope: containerRef.current ? containerRef : undefined },
  );

  return (
    <PageContainer>
      <div ref={containerRef} className="space-y-6">
        {/* NOVA MOTION Hero Banner */}
        <section className="nm-reveal relative overflow-hidden rounded-3xl border border-white/10 bg-[#0C111C] p-6 text-white shadow-xl md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-teal-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-xs font-semibold text-teal-300 backdrop-blur-sm">
                <Bell className="h-3.5 w-3.5 text-teal-300" />
                <span>THÔNG BÁO HỆ THỐNG</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                Hộp thư thông báo
              </h1>
              <p className="text-sm leading-relaxed text-slate-300">
                Theo dõi tiến độ đơn ứng tuyển, cập nhật kết quả gợi ý việc làm và các thông báo mới nhất từ hệ thống.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link to="/candidate/applications">
                <Button
                  variant="secondary"
                  className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20"
                  icon={<FolderKanban className="h-4 w-4" />}
                >
                  Lịch sử ứng tuyển
                </Button>
              </Link>
              <Link to="/candidate/jobs/recommended">
                <Button
                  className="rounded-xl bg-[#D4F933] font-semibold text-[#0C111C] shadow-sm hover:bg-[#C2E82E]"
                  icon={<Sparkles className="h-4 w-4" />}
                >
                  Việc làm gợi ý
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Notifications Panel */}
        <div className="nm-reveal">
          <NotificationsPanel
            role="candidate"
            key={`${currentUser?.id}:${sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)}`}
          />
        </div>
      </div>
    </PageContainer>
  );
}

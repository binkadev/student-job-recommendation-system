import {
  BriefcaseBusiness,
  Copy,
  ExternalLink,
  Github,
  Globe,
  GraduationCap,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Plus,
  UserRound,
  Sparkles,
  Star,
  Layers,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { PageContainer } from "../../components/common/PageContainer";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Tooltip } from "../../components/ui/Tooltip";
import { CandidateProfilePreview } from "../../features/candidate/profile/CandidateProfilePreview";
import { CandidateProfileSkeleton } from "../../features/candidate/profile/CandidateProfileSkeleton";
import { CandidateProfileEditView } from "../../features/candidate/profile/CandidateProfileEditView";
import { CandidatePreferencesView } from "../../features/candidate/profile/CandidatePreferencesView";
import { getCandidateProfileData } from "../../features/candidate/profile/candidateProfileService";
import { isProfileHttpUrl } from "../../features/candidate/profile/candidateProfileExtensions";
import { WORKING_MODEL_LABELS } from "../../features/candidate/profile/candidateProfileTypes";
import type { CandidateSkill } from "../../features/candidate/profile/candidateProfileTypes";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";

const skillGroups = [
  { key: "frontend", label: "Frontend", icon: <Globe size={14} aria-hidden="true" /> },
  { key: "backend", label: "Backend", icon: <Layers size={14} aria-hidden="true" /> },
  { key: "tools", label: "Công cụ", icon: <BriefcaseBusiness size={14} aria-hidden="true" /> },
  { key: "soft", label: "Kỹ năng mềm", icon: <Star size={14} aria-hidden="true" /> },
] as const;

export function CandidateProfilePage({ mode = "view" }: { mode?: "view" | "edit" | "preferences" }) {
  const { showToast } = useToast();
  const [previewOpen, setPreviewOpen] = useState(false);
  const profileQuery = useAsyncData(() => getCandidateProfileData(), []);
  const profile = profileQuery.data;
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (mode !== "view" || profileQuery.loading || !profile || !containerRef.current) return;
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ".nova-profile-reveal",
          { autoAlpha: 0, y: 14 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            ease: "power3.out",
            stagger: 0.06,
            clearProps: "all",
          },
        );
      });

      return () => mm.revert();
    },
    {
      scope: containerRef.current ? containerRef : undefined,
      dependencies: [mode, profileQuery.loading, Boolean(profile)],
    },
  );

  async function copyText(label: string, value: string) {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      showToast({ type: "success", title: `Đã copy ${label}` });
    } catch {
      showToast({ type: "error", title: "Không thể sao chép", message: "Trình duyệt chưa cho phép truy cập bộ nhớ tạm." });
    }
  }

  if (profileQuery.loading) {
    return (
      <PageContainer>
        <CandidateProfileSkeleton />
      </PageContainer>
    );
  }

  if (profileQuery.error || !profile) {
    return (
      <PageContainer>
        <ErrorState message={profileQuery.error ?? "Không thể tải hồ sơ ứng viên."} />
      </PageContainer>
    );
  }

  if (mode === "edit") {
    return <CandidateProfileEditView profile={profile} onSaved={profileQuery.setData} />;
  }

  if (mode === "preferences") {
    return <CandidatePreferencesView />;
  }

  return (
    <PageContainer>
      <CandidateProfilePreview profile={profile} open={previewOpen} onClose={() => setPreviewOpen(false)} />
      <div ref={containerRef} className="space-y-5">
        {/* ── HERO BANNER ─────────────────────────────── */}
        <section className="nova-profile-reveal overflow-hidden rounded-2xl border border-[#E5E9F0] bg-white shadow-sm">
          {/* Midnight header strip */}
          <div className="relative flex min-h-[120px] items-end overflow-hidden bg-[#0C111C] px-6 pb-5 pt-6">
            {/* subtle radial glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background: "radial-gradient(ellipse 60% 80% at 80% 50%, rgba(35,125,112,0.18) 0%, transparent 70%)",
              }}
            />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#237D70]/30 bg-[#237D70]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#78D2C3]">
                <Sparkles size={12} aria-hidden="true" />
                <span>Hồ sơ ứng viên</span>
              </div>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {profile.header.name}
              </h1>
              <p className="mt-1 text-sm text-[#9BB0C9]">{profile.header.currentTitle}</p>
            </div>
          </div>

          {/* Identity row */}
          <div className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#F0FAF8] text-xl font-extrabold text-[#134B43] ring-2 ring-[#D6F2EC]">
                {profile.header.avatar}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-[#0C111C]">{profile.header.name}</h2>
                  <StatusBadge label={profile.header.availability} tone="success" />
                </div>
                <div className="mt-2.5 grid gap-1.5 text-sm text-[#52637A] md:grid-cols-2">
                  <InfoItem icon={<MapPin size={14} />} label={profile.header.location} />
                  <InfoItem icon={<Mail size={14} />} label={profile.header.email} action={<CopyIcon label="email" value={profile.header.email} onCopy={copyText} />} />
                  {profile.header.phone ? <InfoItem icon={<Phone size={14} />} label={profile.header.phone} action={<CopyIcon label="số điện thoại" value={profile.header.phone} onCopy={copyText} />} /> : null}
                  <InfoItem icon={<UserRound size={14} />} label={`${profile.header.completion}% hoàn thiện hồ sơ`} />
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link to="/candidate/profile/edit">
                <Button size="sm">Chỉnh sửa</Button>
              </Link>
              <Button size="sm" variant="secondary" aria-haspopup="dialog" onClick={() => setPreviewOpen(true)}>
                Xem trước hồ sơ
              </Button>
            </div>
          </div>
        </section>

        {/* ── MAIN GRID ───────────────────────────────── */}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_288px]">
          {/* Left column */}
          <div className="min-w-0 space-y-5">
            {/* Giới thiệu */}
            <section className="nova-profile-reveal rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
              <SectionHeader title="Giới thiệu" />
              <div className="grid gap-4">
                <TextBlock
                  title="Hình thức làm việc mong muốn"
                  value={profile.record?.preferredWorkingModel ? WORKING_MODEL_LABELS[profile.record.preferredWorkingModel] : ""}
                  editSection="personal"
                />
                <TextBlock title="Tóm tắt bản thân" value={profile.summary} editSection="summary" />
                <TextBlock title="Mục tiêu nghề nghiệp" value={profile.careerGoal} editSection="career-goal" />
              </div>
            </section>

            {/* Kinh nghiệm */}
            <section className="nova-profile-reveal rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
              <SectionHeader
                title="Kinh nghiệm"
                action={
                  <Link to="/candidate/profile/edit?section=experience" className="inline-flex min-h-[36px] shrink-0 items-center gap-1 text-xs font-semibold text-[#134B43] hover:text-[#237D70]">
                    <Plus size={13} aria-hidden="true" />
                    Thêm
                  </Link>
                }
              />
              {profile.record ? (
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#52637A]">
                  {profile.record.experience || "Chưa cập nhật kinh nghiệm."}
                </p>
              ) : profile.experiences.length ? (
                <div className="space-y-3">
                  {profile.experiences.map((exp) => (
                    <div key={exp.id} className="rounded-xl border border-[#E5E9F0] p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-semibold text-[#0C111C]">{exp.position}</h3>
                          <p className="mt-0.5 text-sm text-[#52637A]">{exp.company} · {exp.period}</p>
                        </div>
                        <BriefcaseBusiness className="shrink-0 text-[#9BB0C9]" size={16} aria-hidden="true" />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#52637A]">{exp.description}</p>
                      <ListBlock title="Thành tựu" items={exp.achievements} />
                      <TagList title="Công nghệ" items={exp.technologies} />
                    </div>
                  ))}
                </div>
              ) : (
                <SmallEmptyState message="Chưa có kinh nghiệm làm việc." section="experience" />
              )}
            </section>

            {/* Học vấn */}
            <section className="nova-profile-reveal rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
              <SectionHeader
                title="Học vấn"
                action={
                  <Link to="/candidate/profile/edit?section=education" className="inline-flex min-h-[36px] shrink-0 items-center gap-1 text-xs font-semibold text-[#134B43] hover:text-[#237D70]">
                    <Plus size={13} aria-hidden="true" />
                    Thêm
                  </Link>
                }
              />
              {profile.record ? (
                <div className="space-y-2 text-sm leading-6 text-[#52637A]">
                  <p>{[profile.record.university, profile.record.major, profile.record.graduationYear].filter(Boolean).join(" · ")}</p>
                  <p className="break-words">Trình độ học vấn: {profile.record.educationLevel || "Chưa thiết lập"}</p>
                  <p>GPA (thang 4): {profile.record.gpa != null ? profile.record.gpa.toFixed(2) : "Chưa thiết lập"}</p>
                  <p className="whitespace-pre-wrap break-words">{profile.record.education || "Chưa cập nhật nội dung học vấn."}</p>
                </div>
              ) : profile.education.length ? (
                <div className="space-y-3">
                  {profile.education.map((edu) => (
                    <div key={edu.id} className="rounded-xl border border-[#E5E9F0] p-4">
                      <div className="flex gap-3">
                        <GraduationCap className="mt-0.5 shrink-0 text-[#237D70]" size={18} aria-hidden="true" />
                        <div>
                          <h3 className="font-semibold text-[#0C111C]">{edu.school}</h3>
                          <p className="mt-0.5 text-sm text-[#52637A]">{edu.major} · {edu.degree}</p>
                          <p className="mt-0.5 text-sm text-[#9BB0C9]">{edu.period} · GPA {edu.gpa}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <SmallEmptyState message="Chưa có thông tin học vấn." section="education" />
              )}
            </section>

            {/* Kỹ năng */}
            <section className="nova-profile-reveal rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
              <SectionHeader
                title="Kỹ năng"
                action={
                  <Link to="/candidate/profile/edit?section=skills" className="inline-flex min-h-[36px] shrink-0 items-center gap-1 text-xs font-semibold text-[#134B43] hover:text-[#237D70]">
                    <Plus size={13} aria-hidden="true" />
                    Thêm
                  </Link>
                }
              />
              <div className="grid gap-3 md:grid-cols-2">
                {skillGroups.map((group) => (
                  <SkillGroup key={group.key} title={group.label} icon={group.icon} skills={profile.skills[group.key]} />
                ))}
              </div>
            </section>

            {/* Chứng chỉ */}
            <section className="nova-profile-reveal rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
              <SectionHeader
                title="Chứng chỉ"
                action={
                  <Link to="/candidate/profile/edit?section=certificates" className="inline-flex min-h-[36px] shrink-0 items-center gap-1 text-xs font-semibold text-[#134B43] hover:text-[#237D70]">
                    <Plus size={13} aria-hidden="true" />
                    Thêm
                  </Link>
                }
              />
              {profile.certificates.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {profile.certificates.map((cert) => (
                    <div key={cert.id} className="rounded-xl border border-[#E5E9F0] bg-[#F7F8F6] p-4">
                      <h3 className="font-semibold text-[#0C111C]">{cert.name}</h3>
                      <p className="mt-0.5 text-sm text-[#52637A]">{cert.issuer}</p>
                      <p className="mt-2 text-xs text-[#9BB0C9]">Cấp: {cert.issuedAt} · Hết hạn: {cert.expiresAt}</p>
                      {cert.code ? <p className="mt-1 break-words text-xs text-[#52637A]">Mã chứng chỉ: {cert.code}</p> : null}
                      {cert.url && isProfileHttpUrl(cert.url) ? <ExternalAnchor href={cert.url} label="Xem chứng chỉ" /> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <SmallEmptyState message="Chưa có chứng chỉ." section="certificates" />
              )}
            </section>

            {/* Dự án */}
            <section className="nova-profile-reveal rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
              <SectionHeader
                title="Dự án"
                action={
                  <Link to="/candidate/profile/edit?section=projects" className="inline-flex min-h-[36px] shrink-0 items-center gap-1 text-xs font-semibold text-[#134B43] hover:text-[#237D70]">
                    <Plus size={13} aria-hidden="true" />
                    Thêm
                  </Link>
                }
              />
              {profile.record ? (
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#52637A]">
                  {profile.record.projects || "Chưa cập nhật dự án."}
                </p>
              ) : profile.projects.length ? (
                <div className="space-y-3">
                  {profile.projects.map((project) => (
                    <div key={project.id} className="rounded-xl border border-[#E5E9F0] p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-semibold text-[#0C111C]">{project.name}</h3>
                          <p className="mt-0.5 text-sm text-[#52637A]">{project.role} · {project.period}</p>
                        </div>
                        <ExternalAnchor href={project.url} label="Mở dự án" compact />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#52637A]">{project.description}</p>
                      <TagList title="Công nghệ" items={project.technologies} />
                    </div>
                  ))}
                </div>
              ) : (
                <SmallEmptyState message="Chưa có dự án." section="projects" />
              )}
            </section>
          </div>

          {/* Right sidebar */}
          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            {/* Profile completion */}
            <div className="nova-profile-reveal rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
              <SectionHeader title="Hoàn thiện hồ sơ" />
              <ProgressBar value={profile.header.completion} label="Mức độ hoàn thiện" />
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/candidate/profile/edit">
                  <Button size="sm">Cập nhật hồ sơ</Button>
                </Link>
                <Link to="/candidate/profile/preferences">
                  <Button size="sm" variant="secondary">Mong muốn nghề nghiệp</Button>
                </Link>
              </div>
            </div>

            {/* Ngoại ngữ */}
            <div className="nova-profile-reveal rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
              <SectionHeader title="Ngoại ngữ" />
              {profile.languages.length ? (
                <div className="space-y-2">
                  {profile.languages.map((language) => (
                    <div key={language.id} className="flex items-center justify-between rounded-xl border border-[#E5E9F0] px-3 py-2 text-sm">
                      <span className="font-medium text-[#0C111C]">{language.name}</span>
                      <StatusBadge label={language.level} />
                    </div>
                  ))}
                </div>
              ) : (
                <SmallEmptyState message="Chưa có ngoại ngữ." section="languages" />
              )}
            </div>

            {/* Liên kết */}
            <div className="nova-profile-reveal rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
              <SectionHeader title="Liên kết" />
              <div className="grid gap-2">
                <ProfileLink icon={<Linkedin size={15} />} label="LinkedIn" href={profile.links.linkedIn} />
                <ProfileLink icon={<Github size={15} />} label="GitHub" href={profile.links.github} />
                <ProfileLink icon={<Globe size={15} />} label="Portfolio" href={profile.links.portfolio} />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PageContainer>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function InfoItem({ icon, label, action }: { icon: ReactNode; label: string; action?: ReactNode }) {
  return (
    <p className="flex min-w-0 items-center gap-2 [&>svg]:shrink-0">
      {icon}
      <span className="min-w-0 break-words">{label}</span>
      {action}
    </p>
  );
}

function CopyIcon({ label, value, onCopy }: { label: string; value: string; onCopy: (label: string, value: string) => void }) {
  return (
    <Tooltip label={`Copy ${label}`}>
      <IconButton aria-label={`Copy ${label}`} size="sm" variant="ghost" icon={<Copy size={13} />} onClick={() => void onCopy(label, value)} />
    </Tooltip>
  );
}

function TextBlock({ title, value, editSection }: { title: string; value: string; editSection: string }) {
  if (!value) return <SmallEmptyState message={`Chưa có ${title.toLowerCase()}.`} section={editSection} />;
  return (
    <div className="rounded-xl bg-[#F7F8F6] p-4">
      <h3 className="text-sm font-semibold text-[#0C111C]">{title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-[#52637A]">{value}</p>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <p className="text-sm font-medium text-[#0C111C]">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#52637A]">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function TagList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-sm font-medium text-[#0C111C]">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className="inline-flex items-center rounded-full border border-[#D6F2EC] bg-[#F0FAF8] px-2.5 py-0.5 text-xs font-medium text-[#134B43]">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function SkillGroup({ title, icon, skills }: { title: string; icon: ReactNode; skills: CandidateSkill[] }) {
  return (
    <div className="rounded-xl border border-[#E5E9F0] bg-[#F7F8F6] p-4">
      <div className="flex items-center gap-2">
        <span className="text-[#237D70]">{icon}</span>
        <h3 className="text-sm font-semibold text-[#0C111C]">{title}</h3>
      </div>
      {skills.length ? (
        <div className="mt-3 space-y-2.5">
          {skills.map((skill) => (
            <div key={skill.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-[#0C111C]">{skill.name}</span>
              <span className="shrink-0 text-xs text-[#9BB0C9]">{skill.level} · {skill.years}n</span>
            </div>
          ))}
        </div>
      ) : (
        <SmallEmptyState message={`Chưa có kỹ năng ${title.toLowerCase()}.`} section="skills" />
      )}
    </div>
  );
}

function SmallEmptyState({ message, section }: { message: string; section: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#E5E9F0] p-4">
      <EmptyState message={message} />
      <Link to={`/candidate/profile/edit?section=${section}`} className="mt-3 inline-flex">
        <Button size="sm" variant="secondary" icon={<Plus size={13} />}>Thêm thông tin</Button>
      </Link>
    </div>
  );
}

function ExternalAnchor({ href, label, compact = false }: { href: string; label: string; compact?: boolean }) {
  return (
    <a
      href={href.trim()}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-[#134B43] hover:text-[#237D70] ${compact ? "" : "mt-3"}`}
    >
      {label}
      <ExternalLink size={13} aria-hidden="true" />
    </a>
  );
}

function ProfileLink({ icon, label, href }: { icon: ReactNode; label: string; href: string }) {
  if (!href || !isProfileHttpUrl(href)) return <SmallEmptyState message={`Chưa có ${label}.`} section="links" />;
  return (
    <Tooltip label={`Mở ${label}`}>
      <a
        href={href.trim()}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-between rounded-xl border border-[#E5E9F0] px-3 py-2.5 text-sm transition-colors hover:border-[#D6F2EC] hover:bg-[#F0FAF8]"
      >
        <span className="inline-flex items-center gap-2 font-medium text-[#0C111C]">{icon}{label}</span>
        <ExternalLink size={13} className="text-[#9BB0C9]" aria-hidden="true" />
      </a>
    </Tooltip>
  );
}


import { BriefcaseBusiness, Copy, ExternalLink, Github, Globe, GraduationCap, Linkedin, Mail, MapPin, Phone, Plus, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { IconButton } from "../../components/ui/IconButton";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Tooltip } from "../../components/ui/Tooltip";
import { CandidateProfileSkeleton } from "../../features/candidate/profile/CandidateProfileSkeleton";
import { CandidateProfileEditView } from "../../features/candidate/profile/CandidateProfileEditView";
import { CandidatePreferencesView } from "../../features/candidate/profile/CandidatePreferencesView";
import { getCandidateProfileData } from "../../features/candidate/profile/candidateProfileService";
import type { CandidateSkill } from "../../features/candidate/profile/candidateProfileTypes";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";

const skillGroups = [
  { key: "frontend", label: "Frontend" },
  { key: "backend", label: "Backend" },
  { key: "tools", label: "Công cụ" },
  { key: "soft", label: "Kỹ năng mềm" },
] as const;

export function CandidateProfilePage({ mode = "view" }: { mode?: "view" | "edit" | "preferences" }) {
  const { showToast } = useToast();
  const profileQuery = useAsyncData(() => getCandidateProfileData(), []);
  const profile = profileQuery.data;

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard?.writeText(value);
      showToast({ type: "success", title: `Đã copy ${label}` });
    } catch {
      showToast({ type: "success", title: `Đã tạo nội dung copy`, message: value });
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
    return <CandidateProfileEditView profile={profile} />;
  }

  if (mode === "preferences") {
    return <CandidatePreferencesView />;
  }

  return (
    <PageContainer>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex min-h-40 items-end bg-slate-950 p-6 text-white">
          <div>
            <p className="text-sm text-slate-300">Hồ sơ ứng viên</p>
            <h1 className="mt-2 text-3xl font-semibold">{profile.header.name}</h1>
          </div>
        </div>
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-2xl font-semibold text-brand-700">{profile.header.avatar}</div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-slate-950">{profile.header.name}</h2>
                <StatusBadge label={profile.header.availability} tone="success" />
              </div>
              <p className="mt-1 text-sm font-medium text-slate-700">{profile.header.currentTitle}</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                <InfoItem icon={<MapPin size={16} />} label={profile.header.location} />
                <InfoItem icon={<Mail size={16} />} label={profile.header.email} action={<CopyIcon label="email" value={profile.header.email} onCopy={copyText} />} />
                <InfoItem icon={<Phone size={16} />} label={profile.header.phone} action={<CopyIcon label="số điện thoại" value={profile.header.phone} onCopy={copyText} />} />
                <InfoItem icon={<UserRound size={16} />} label={`${profile.header.completion}% hoàn thiện`} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/candidate/profile/edit"><Button>Chỉnh sửa</Button></Link>
            <Button variant="secondary" onClick={() => showToast({ type: "success", title: "Đã mở chế độ xem hồ sơ công khai mock" })}>Xem hồ sơ công khai</Button>
          </div>
        </div>
      </section>

      {mode !== "view" ? (
        <Card className="mt-5">
          <p className="text-sm text-slate-600">Bạn đang truy cập route chỉnh sửa/thiết lập. Trang chỉnh sửa chi tiết sẽ được triển khai ở bước riêng; bên dưới vẫn hiển thị bản xem hồ sơ hiện tại.</p>
        </Card>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <main className="space-y-5">
          <Card>
            <SectionHeader title="Giới thiệu" />
            <div className="grid gap-4">
              <TextBlock title="Tóm tắt bản thân" value={profile.summary} editSection="summary" />
              <TextBlock title="Mục tiêu nghề nghiệp" value={profile.careerGoal} editSection="career-goal" />
            </div>
          </Card>

          <Card>
            <SectionHeader title="Kinh nghiệm" />
            {profile.experiences.length ? (
              <div className="space-y-4">
                {profile.experiences.map((experience) => (
                  <div key={experience.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-950">{experience.position}</h3>
                        <p className="mt-1 text-sm text-slate-600">{experience.company} · {experience.period}</p>
                      </div>
                      <BriefcaseBusiness className="text-slate-400" size={18} />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{experience.description}</p>
                    <ListBlock title="Thành tựu" items={experience.achievements} />
                    <TagList title="Công nghệ" items={experience.technologies} />
                  </div>
                ))}
              </div>
            ) : (
              <SmallEmptyState message="Chưa có kinh nghiệm làm việc." section="experience" />
            )}
          </Card>

          <Card>
            <SectionHeader title="Học vấn" />
            {profile.education.length ? (
              <div className="space-y-4">
                {profile.education.map((education) => (
                  <div key={education.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex gap-3">
                      <GraduationCap className="mt-1 text-brand-700" size={20} />
                      <div>
                        <h3 className="font-semibold text-slate-950">{education.school}</h3>
                        <p className="mt-1 text-sm text-slate-600">{education.major} · {education.degree}</p>
                        <p className="mt-1 text-sm text-slate-500">{education.period} · GPA {education.gpa}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <SmallEmptyState message="Chưa có thông tin học vấn." section="education" />
            )}
          </Card>

          <Card>
            <SectionHeader title="Kỹ năng" />
            <div className="grid gap-4 md:grid-cols-2">
              {skillGroups.map((group) => (
                <SkillGroup key={group.key} title={group.label} skills={profile.skills[group.key]} />
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader title="Chứng chỉ" />
            {profile.certificates.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {profile.certificates.map((certificate) => (
                  <div key={certificate.id} className="rounded-lg border border-slate-200 p-4">
                    <h3 className="font-semibold text-slate-950">{certificate.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">{certificate.issuer}</p>
                    <p className="mt-2 text-sm text-slate-500">Cấp: {certificate.issuedAt} · Hết hạn: {certificate.expiresAt}</p>
                    <ExternalAnchor href={certificate.url} label="Xem chứng chỉ" />
                  </div>
                ))}
              </div>
            ) : (
              <SmallEmptyState message="Chưa có chứng chỉ." section="certificates" />
            )}
          </Card>

          <Card>
            <SectionHeader title="Dự án" />
            {profile.projects.length ? (
              <div className="space-y-4">
                {profile.projects.map((project) => (
                  <div key={project.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-950">{project.name}</h3>
                        <p className="mt-1 text-sm text-slate-600">{project.role} · {project.period}</p>
                      </div>
                      <ExternalAnchor href={project.url} label="Mở dự án" compact />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{project.description}</p>
                    <TagList title="Công nghệ" items={project.technologies} />
                  </div>
                ))}
              </div>
            ) : (
              <SmallEmptyState message="Chưa có dự án." section="projects" />
            )}
          </Card>
        </main>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <SectionHeader title="Hoàn thiện hồ sơ" />
            <ProgressBar value={profile.header.completion} label="Mức độ hoàn thiện" />
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/candidate/profile/edit"><Button size="sm" variant="secondary">Cập nhật hồ sơ</Button></Link>
              <Link to="/candidate/profile/preferences"><Button size="sm" variant="secondary">Mong muốn nghề nghiệp</Button></Link>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Ngoại ngữ" />
            {profile.languages.length ? (
              <div className="space-y-3">
                {profile.languages.map((language) => (
                  <div key={language.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                    <span>{language.name}</span>
                    <StatusBadge label={language.level} />
                  </div>
                ))}
              </div>
            ) : (
              <SmallEmptyState message="Chưa có ngoại ngữ." section="languages" />
            )}
          </Card>

          <Card>
            <SectionHeader title="Liên kết" />
            <div className="grid gap-2">
              <ProfileLink icon={<Linkedin size={16} />} label="LinkedIn" href={profile.links.linkedIn} />
              <ProfileLink icon={<Github size={16} />} label="GitHub" href={profile.links.github} />
              <ProfileLink icon={<Globe size={16} />} label="Portfolio" href={profile.links.portfolio} />
              <ProfileLink icon={<Globe size={16} />} label="Website" href={profile.links.website} />
            </div>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}

function InfoItem({ icon, label, action }: { icon: ReactNode; label: string; action?: ReactNode }) {
  return (
    <p className="flex items-center gap-2">
      {icon}
      <span>{label}</span>
      {action}
    </p>
  );
}

function CopyIcon({ label, value, onCopy }: { label: string; value: string; onCopy: (label: string, value: string) => void }) {
  return (
    <Tooltip label={`Copy ${label}`}>
      <IconButton aria-label={`Copy ${label}`} size="sm" variant="ghost" icon={<Copy size={14} />} onClick={() => void onCopy(label, value)} />
    </Tooltip>
  );
}

function TextBlock({ title, value, editSection }: { title: string; value: string; editSection: string }) {
  if (!value) return <SmallEmptyState message={`Chưa có ${title.toLowerCase()}.`} section={editSection} />;
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function TagList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <p className="mb-2 text-sm font-medium text-slate-900">{title}</p>
      <div className="flex flex-wrap gap-2">{items.map((item) => <StatusBadge key={item} label={item} />)}</div>
    </div>
  );
}

function SkillGroup({ title, skills }: { title: string; skills: CandidateSkill[] }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-950">{title}</h3>
      {skills.length ? (
        <div className="mt-3 space-y-3">
          {skills.map((skill) => (
            <div key={skill.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-800">{skill.name}</span>
              <span className="text-slate-500">{skill.level} · {skill.years} năm</span>
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
    <div className="rounded-lg border border-dashed border-slate-200 p-4">
      <EmptyState message={message} />
      <Link to={`/candidate/profile/edit?section=${section}`} className="mt-3 inline-flex">
        <Button size="sm" variant="secondary" icon={<Plus size={14} />}>Thêm thông tin</Button>
      </Link>
    </div>
  );
}

function ExternalAnchor({ href, label, compact = false }: { href: string; label: string; compact?: boolean }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`mt-3 inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800 ${compact ? "mt-0" : ""}`}>
      {label} <ExternalLink size={14} />
    </a>
  );
}

function ProfileLink({ icon, label, href }: { icon: ReactNode; label: string; href: string }) {
  if (!href) return <SmallEmptyState message={`Chưa có ${label}.`} section="links" />;
  return (
    <Tooltip label={`Mở ${label}`}>
      <a href={href} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm hover:border-brand-200 hover:bg-brand-50">
        <span className="inline-flex items-center gap-2">{icon}{label}</span>
        <ExternalLink size={14} className="text-slate-400" />
      </a>
    </Tooltip>
  );
}

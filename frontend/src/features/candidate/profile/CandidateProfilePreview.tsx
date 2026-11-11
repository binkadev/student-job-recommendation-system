import type { ReactNode } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Modal } from "../../../components/ui/Modal";
import { isProfileHttpUrl } from "./candidateProfileExtensions";
import type { CandidateProfileData } from "./candidateProfileTypes";

/** A read-only, allowlisted view of the already loaded, saved profile. */
export function CandidateProfilePreview({ profile, open, onClose }: {
  profile: CandidateProfileData; open: boolean; onClose: () => void;
}) {
  const record = profile.record;
  const skills = Object.values(profile.skills).flat().filter((skill) => skill.name.trim());
  const certificates = profile.certificates.filter((item) => item.name.trim());
  const languages = profile.languages.filter((item) => item.name.trim());
  const links = [
    { label: "GitHub", url: profile.links.github },
    { label: "LinkedIn", url: profile.links.linkedIn },
    { label: "Portfolio", url: profile.links.portfolio },
  ].filter((item) => validLink(item.url));
  // The transport mapper can use email as the display-name fallback; keep it private here.
  const name = profile.header.name.trim();
  const displayName = name && !name.includes("@") ? name : "Ứng viên";
  const academicDetails = [record?.university, record?.major, record?.educationLevel,
    record?.graduationYear != null ? `Tốt nghiệp ${record.graduationYear}` : "",
    record?.gpa != null ? `GPA ${record.gpa.toFixed(2)}/4.00` : "",
  ].filter((value) => value?.trim());

  return (
    <Modal open={open} onClose={onClose} title="Xem trước hồ sơ ứng viên" size="xl">
      <div className="min-w-0 space-y-5 [overflow-wrap:anywhere]">
        <p className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
          Bản xem trước dành cho bạn, dựa trên hồ sơ đã lưu. Đây là bản tự xem, chưa công khai hồ sơ và không tạo liên kết chia sẻ.
        </p>
        <div>
          <h3 className="text-xl font-semibold text-slate-950">{displayName}</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{profile.header.currentTitle.trim() || "Chưa cập nhật chức danh."}</p>
        </div>
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <PreviewSection title="Giới thiệu"><PreviewText value={profile.summary} empty="Chưa cập nhật giới thiệu." /></PreviewSection>
          <PreviewSection title="Học vấn">
            {academicDetails.length ? <p className="mb-3 whitespace-pre-wrap">{academicDetails.join(" · ")}</p> : null}
            {record?.education?.trim() ? <PreviewText value={record.education} empty="" /> : !academicDetails.length ? <p>Chưa cập nhật học vấn.</p> : null}
          </PreviewSection>
          <PreviewSection title="Kinh nghiệm"><PreviewText value={record?.experience} empty="Chưa cập nhật kinh nghiệm." /></PreviewSection>
          <PreviewSection title="Dự án"><PreviewText value={record?.projects} empty="Chưa cập nhật dự án." /></PreviewSection>
          <PreviewSection title="Kỹ năng">
            {skills.length ? <ul className="space-y-2">{skills.map((skill) => <li key={skill.id}>
              <span className="font-medium">{skill.name}</span>{skill.level.trim() ? ` · ${skill.level}` : ""}
              {skill.storedYears !== null && Number.isFinite(skill.years) && skill.years > 0 ? ` · ${skill.years} năm kinh nghiệm` : ""}
            </li>)}</ul> : <p>Chưa cập nhật kỹ năng.</p>}
          </PreviewSection>
          <PreviewSection title="Chứng chỉ">
            {certificates.length ? <ul className="space-y-4">{certificates.map((item) => <li key={item.id}>
              <p className="font-medium">{item.name}</p>
              {item.issuer.trim() ? <p>{item.issuer}</p> : null}
              {item.issuedAt.trim() ? <p>Cấp: {item.issuedAt}</p> : null}
              {item.expiresAt.trim() ? <p>Hết hạn: {item.expiresAt}</p> : null}
              {validLink(item.url) ? <PreviewLink url={item.url} label={`Xem chứng chỉ ${item.name}`} /> : null}
            </li>)}</ul> : <p>Chưa cập nhật chứng chỉ.</p>}
          </PreviewSection>
          <PreviewSection title="Ngoại ngữ">
            {languages.length ? <ul className="space-y-2">{languages.map((item) => <li key={item.id}>{item.name}{item.level.trim() ? ` · ${item.level}` : ""}</li>)}</ul> : <p>Chưa cập nhật ngoại ngữ.</p>}
          </PreviewSection>
          <PreviewSection title="Liên kết hồ sơ">
            {links.length ? <ul className="space-y-2">{links.map((item) => <li key={item.label}><PreviewLink url={item.url} label={item.label} /></li>)}</ul> : <p>Chưa có liên kết hợp lệ.</p>}
          </PreviewSection>
        </div>
        <div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Đóng bản xem trước</Button></div>
      </div>
    </Modal>
  );
}

function PreviewSection({ title, children }: { title: string; children: ReactNode }) {
  return <Card><h4 className="mb-3 text-base font-semibold text-slate-950">{title}</h4><div className="text-sm leading-6 text-slate-700">{children}</div></Card>;
}
function PreviewText({ value, empty }: { value?: string | null; empty: string }) {
  return <p className="whitespace-pre-wrap">{value?.trim() ? value : empty}</p>;
}
function validLink(url: string) { return Boolean(url.trim()) && url.length <= 500 && isProfileHttpUrl(url); }
function PreviewLink({ url, label }: { url: string; label: string }) {
  return <a href={url.trim()} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg font-medium text-brand-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200">{label}<span className="sr-only"> (mở trong thẻ mới)</span></a>;
}

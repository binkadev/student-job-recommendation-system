import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Save, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams, Link } from "react-router-dom";
import { z } from "zod";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import { PageContainer } from "../../../components/common/PageContainer";
import { SectionHeader } from "../../../components/common/SectionHeader";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import { useToast } from "../../../hooks/useToast";
import { getApiErrorMessage } from "../../../utils/apiErrors";
import { getCandidateProfileData, isProfileConflict, updateCandidateProfileData } from "./candidateProfileService";
import type { CandidateProfileData, CandidateSkill } from "./candidateProfileTypes";

type EditTab = "personal" | "about" | "experience" | "education" | "skills" | "projects";
const tabs: Array<{ label: string; value: EditTab }> = [
  { label: "Thông tin cá nhân", value: "personal" }, { label: "Giới thiệu", value: "about" },
  { label: "Kinh nghiệm", value: "experience" }, { label: "Học vấn", value: "education" },
  { label: "Kỹ năng", value: "skills" }, { label: "Dự án", value: "projects" },
];
const availabilityOptions = [
  { label: "Chưa thiết lập", value: "" }, { label: "Toàn thời gian", value: "FULL_TIME" },
  { label: "Bán thời gian", value: "PART_TIME" }, { label: "Thực tập", value: "INTERNSHIP" },
  { label: "Hợp đồng", value: "CONTRACT" },
];
const shortText = z.string().max(255, "Tối đa 255 ký tự.");
const sectionText = z.string().max(5000, "Tối đa 5.000 ký tự.");
const editSchema = z.object({
  name: shortText.trim().min(2, "Vui lòng nhập họ tên."),
  phone: z.string().max(50, "Số điện thoại tối đa 50 ký tự."),
  location: shortText, currentTitle: shortText,
  availability: z.enum(["", "FULL_TIME", "PART_TIME", "INTERNSHIP", "CONTRACT"]),
  summary: sectionText, careerGoal: shortText, preferredLocation: shortText,
  education: sectionText, experience: sectionText, projects: sectionText,
  major: shortText, university: shortText,
  graduationYear: z.string().refine((value) => !value || (/^\d{4}$/.test(value) && Number(value) >= 1900 && Number(value) <= 2100), "Năm tốt nghiệp từ 1900 đến 2100."),
});
type EditFormValues = z.infer<typeof editSchema>;
const fieldTabs: Record<string, EditTab> = {
  summary: "about", careerGoal: "about", preferredLocation: "about", experience: "experience",
  education: "education", major: "education", university: "education", graduationYear: "education", projects: "projects",
};

export function CandidateProfileEditView({ profile, onSaved }: { profile: CandidateProfileData; onSaved?: (profile: CandidateProfileData) => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = normalizeTab(searchParams.get("section"));
  const [savedProfile, setSavedProfile] = useState(profile);
  const [skills, setSkills] = useState(flattenSkills(profile));
  const [deleteTarget, setDeleteTarget] = useState<{ label: string; onConfirm: () => void } | null>(null);
  const [saveError, setSaveError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [latestProfile, setLatestProfile] = useState<CandidateProfileData | null>(null);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const [focusField, setFocusField] = useState<keyof EditFormValues | null>(null);
  const saving = useRef(false);
  const { showToast } = useToast();
  const { register, handleSubmit, formState: { errors, isDirty, isSubmitting }, reset, setFocus, watch } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema), defaultValues: toEditFormValues(profile),
  });
  const listsDirty = JSON.stringify(skills) !== JSON.stringify(flattenSkills(savedProfile));
  const dirty = isDirty || listsDirty;
  const draftValues = watch();
  function selectTab(tab: EditTab) {
    setSearchParams((current) => { current.set("section", tab); return current; }, { replace: true });
  }
  useEffect(() => {
    if (!focusField) return;
    setFocus(focusField);
    setFocusField(null);
  }, [focusField, activeTab, setFocus]);
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault(); event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  async function saveAll(values: EditFormValues) {
    if (saving.current || conflict) return;
    setSaveError("");
    if (!savedProfile.record) {
      setSaveError("Hãy tải lại hồ sơ trước khi lưu để bảo toàn dữ liệu hiện có.");
      return;
    }
    const names = skills.map((skill) => skill.name.trim().toLowerCase());
    if (names.some((name) => !name || name.length > 150) || new Set(names).size !== names.length ||
        skills.some((skill) => !Number.isFinite(skill.years) || skill.years < 0 || skill.years > 999.9 || Math.abs(skill.years * 10 - Math.round(skill.years * 10)) > 1e-8)) {
      selectTab("skills");
      setSaveError("Kỹ năng cần tên riêng biệt (tối đa 150 ký tự) và số năm từ 0 đến 999,9, tối đa một chữ số thập phân.");
      return;
    }
    saving.current = true;
    try {
      const updated = await updateCandidateProfileData({
        ...savedProfile,
        header: { ...savedProfile.header, name: values.name, phone: values.phone, location: values.location,
          currentTitle: values.currentTitle, preferredJobType: values.availability || null },
        summary: values.summary, careerGoal: values.careerGoal,
        record: { major: values.major, university: values.university, graduationYear: values.graduationYear ? Number(values.graduationYear) : null,
          education: values.education, experience: values.experience, projects: values.projects, preferredLocation: values.preferredLocation },
        skills: groupSkills(skills),
      });
      setSavedProfile(updated); setSkills(flattenSkills(updated)); reset(toEditFormValues(updated)); onSaved?.(updated);
      setLatestProfile(null);
      showToast({ type: "success", title: "Đã lưu hồ sơ", message: "Thông tin cá nhân, hồ sơ và kỹ năng đã được lưu cùng nhau." });
    } catch (error) {
      if (isProfileConflict(error)) setConflict(true);
      setSaveError(getApiErrorMessage(error, "Chưa xác nhận lưu thành công. Bản đang soạn vẫn được giữ; bạn có thể thử lại hoặc tải bản mới để đối chiếu."));
    } finally { saving.current = false; }
  }

  return (
    <PageContainer>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-2xl font-semibold text-slate-950">Chỉnh sửa hồ sơ ứng viên</h1>
          <p className="mt-1 text-sm text-slate-600">Cập nhật thông tin cá nhân, nội dung hồ sơ và kỹ năng. Các mục học vấn, kinh nghiệm, dự án được lưu dạng văn bản.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" form="candidate-profile-form" loading={isSubmitting} disabled={conflict || loadingLatest} icon={<Save size={16} />}>Lưu hồ sơ</Button>
          <Button disabled={isSubmitting} variant="secondary" icon={<X size={16} />} onClick={() => {
            reset(toEditFormValues(savedProfile)); setSkills(flattenSkills(savedProfile)); if (!conflict) setSaveError("");
          }}>Hủy thay đổi</Button>
          <Link to="/candidate/profile" className={isSubmitting ? "pointer-events-none" : ""} aria-disabled={isSubmitting || undefined}><Button disabled={isSubmitting} variant="secondary">Xem hồ sơ</Button></Link>
        </div>
      </div>
      <form id="candidate-profile-form" noValidate onSubmit={handleSubmit(saveAll, (invalid) => {
        const field = Object.keys(invalid)[0] as keyof EditFormValues;
        selectTab(fieldTabs[field] ?? "personal"); setFocusField(field); setSaveError("Vui lòng kiểm tra các trường có lỗi trước khi lưu.");
      })}>
        {saveError ? <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{saveError}</p> : null}
        {saveError || conflict ? <Card className="mb-4">
          <p className="mb-3 text-sm">Tải bản mới chỉ để đối chiếu, không thay bản đang soạn và không tự gửi lại yêu cầu lưu.</p>
          <Button type="button" variant="secondary" loading={loadingLatest} onClick={async () => {
            setLoadingLatest(true);
            try { setLatestProfile(await getCandidateProfileData()); }
            catch (error) { setSaveError(getApiErrorMessage(error, "Không tải được bản mới. Bản đang soạn vẫn được giữ.")); }
            finally { setLoadingLatest(false); }
          }}>Tải bản mới để đối chiếu</Button>
        </Card> : null}
        {latestProfile ? <Card className="mb-4">
          <SectionHeader title="Đối chiếu hồ sơ" description="Kiểm tra các khác biệt trước khi quyết định tải lại. Không có thay đổi nào được tự động ghi đè." />
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Trường</th><th className="p-2">Bản đang soạn</th><th className="p-2">Bản mới</th></tr></thead><tbody>
            {Object.entries(toEditFormValues(latestProfile)).filter(([key, value]) => draftValues[key as keyof EditFormValues] !== value).map(([key, value]) => <tr key={key}>
              <th className="p-2">{comparisonLabels[key] ?? key}</th><td className="whitespace-pre-wrap break-words p-2">{draftValues[key as keyof EditFormValues] || "(Trống)"}</td><td className="whitespace-pre-wrap break-words p-2">{value || "(Trống)"}</td>
            </tr>)}
            <tr><th className="p-2">Kỹ năng</th><td className="whitespace-pre-wrap p-2">{skillComparison(skills)}</td><td className="whitespace-pre-wrap p-2">{skillComparison(flattenSkills(latestProfile))}</td></tr>
          </tbody></table></div>
          <Button type="button" variant="secondary" className="mt-4" onClick={() => setConfirmReload(true)}>Thay bản nháp bằng bản mới</Button>
        </Card> : null}
        <fieldset disabled={isSubmitting} className="grid min-w-0 gap-5 lg:grid-cols-[230px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start"><Card><nav aria-label="Các mục hồ sơ" className="grid gap-2">
            {tabs.map((tab) => <button key={tab.value} type="button" aria-current={activeTab === tab.value ? "page" : undefined} onClick={() => selectTab(tab.value)}
              className={`min-h-11 rounded-lg border px-3 text-left text-sm font-medium focus-visible:ring-4 focus-visible:ring-brand-200 ${activeTab === tab.value ? "border-brand-200 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-700"}`}>{tab.label}</button>)}
          </nav>{dirty ? <p role="status" className="mt-4 text-sm text-amber-800">Bạn có thay đổi chưa lưu.</p> : null}</Card></aside>
          <div className="min-w-0 space-y-5">
            {activeTab === "personal" ? <Card><SectionHeader title="Thông tin cá nhân" /><div className="grid gap-4 md:grid-cols-2">
              <Input label="Họ tên" error={errors.name?.message} {...register("name")} />
              <Input label="Email" value={profile.header.email} readOnly />
              <Input label="Số điện thoại" type="tel" error={errors.phone?.message} {...register("phone")} />
              <Input label="Tỉnh thành hiện tại" error={errors.location?.message} {...register("location")} />
              <Input label="Chức danh hiện tại" error={errors.currentTitle?.message} {...register("currentTitle")} />
              <Select label="Loại hình công việc mong muốn" options={availabilityOptions} error={errors.availability?.message} {...register("availability")} />
            </div><p className="mt-4 text-sm text-slate-500">Email chỉ đọc. Dữ liệu được lưu cùng nhau và kiểm tra phiên bản trước khi cập nhật.</p></Card> : null}
            {activeTab === "about" ? <Card><SectionHeader title="Giới thiệu và mong muốn nghề nghiệp" /><div className="grid gap-4">
              <Textarea label="Giới thiệu bản thân" rows={6} error={errors.summary?.message} {...register("summary")} />
              <Input label="Vị trí mong muốn" error={errors.careerGoal?.message} {...register("careerGoal")} />
              <Input label="Địa điểm mong muốn" error={errors.preferredLocation?.message} {...register("preferredLocation")} />
            </div></Card> : null}
            {activeTab === "education" ? <Card><SectionHeader title="Học vấn" /><div className="grid gap-4 md:grid-cols-2">
              <Input label="Trường" error={errors.university?.message} {...register("university")} />
              <Input label="Chuyên ngành" error={errors.major?.message} {...register("major")} />
              <Input label="Năm tốt nghiệp" inputMode="numeric" error={errors.graduationYear?.message} {...register("graduationYear")} />
              <div className="md:col-span-2"><Textarea label="Nội dung học vấn" rows={8} error={errors.education?.message} {...register("education")} /></div>
            </div></Card> : null}
            {activeTab === "experience" ? <Card><SectionHeader title="Kinh nghiệm" /><Textarea label="Nội dung kinh nghiệm" rows={12} error={errors.experience?.message} {...register("experience")} /></Card> : null}
            {activeTab === "projects" ? <Card><SectionHeader title="Dự án" /><Textarea label="Nội dung dự án" rows={12} error={errors.projects?.message} {...register("projects")} /></Card> : null}
            {activeTab === "skills" ? <SkillEditor items={skills} setItems={setSkills} onDelete={setDeleteTarget} /> : null}
          </div>
        </fieldset>
      </form>
      <Modal open={Boolean(deleteTarget)} title="Xóa kỹ năng khỏi bản chỉnh sửa" onClose={() => setDeleteTarget(null)}>
        <ConfirmDialog danger title="Xóa kỹ năng này?" description="Thay đổi chỉ được lưu vào hệ thống khi bạn chọn Lưu hồ sơ." confirmLabel="Xóa" onCancel={() => setDeleteTarget(null)} onConfirm={() => { deleteTarget?.onConfirm(); setDeleteTarget(null); }} />
      </Modal>
      <Modal open={confirmReload} title="Tải lại hồ sơ mới nhất" onClose={() => setConfirmReload(false)}>
        <ConfirmDialog danger title="Thay bản đang soạn?" description="Bản đang soạn sẽ được thay bằng bản mới từ hệ thống. Hãy đối chiếu hoặc ghi lại nội dung cần giữ trước khi xác nhận." confirmLabel="Xác nhận tải lại" onCancel={() => setConfirmReload(false)} onConfirm={() => {
          if (!latestProfile) return;
          setSavedProfile(latestProfile); setSkills(flattenSkills(latestProfile)); reset(toEditFormValues(latestProfile)); onSaved?.(latestProfile);
          setSaveError(""); setConflict(false); setConfirmReload(false); setLatestProfile(null);
        }} />
      </Modal>
    </PageContainer>
  );
}

function normalizeTab(section: string | null): EditTab {
  if (section === "summary" || section === "career-goal") return "about";
  return tabs.some((tab) => tab.value === section) ? section as EditTab : "personal";
}
function toEditFormValues(profile: CandidateProfileData): EditFormValues {
  return {
    name: profile.header.name, phone: profile.header.phone, location: profile.header.location,
    currentTitle: profile.header.currentTitle, availability: (profile.header.preferredJobType ?? "") as EditFormValues["availability"],
    summary: profile.summary, careerGoal: profile.careerGoal, preferredLocation: profile.record?.preferredLocation ?? "",
    education: profile.record?.education ?? "", experience: profile.record?.experience ?? "", projects: profile.record?.projects ?? "",
    university: profile.record?.university ?? "", major: profile.record?.major ?? "", graduationYear: profile.record?.graduationYear?.toString() ?? "",
  };
}
function newId(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }
function SectionActions({ onAdd }: { onAdd: () => void }) {
  return <Button type="button" size="sm" variant="secondary" icon={<Plus size={14} />} onClick={onAdd}>Thêm</Button>;
}

function flattenSkills(profile: CandidateProfileData) {
  return [
    ...profile.skills.frontend.map((skill) => ({ ...skill, group: "frontend" })),
    ...profile.skills.backend.map((skill) => ({ ...skill, group: "backend" })),
    ...profile.skills.tools.map((skill) => ({ ...skill, group: "tools" })),
    ...profile.skills.soft.map((skill) => ({ ...skill, group: "soft" })),
  ];
}

function groupSkills(items: Array<CandidateSkill & { group: string }>): CandidateProfileData["skills"] {
  return {
    frontend: items.filter((item) => item.group === "frontend").map(stripGroup),
    backend: items.filter((item) => item.group === "backend").map(stripGroup),
    tools: items.filter((item) => item.group === "tools").map(stripGroup),
    soft: items.filter((item) => item.group === "soft").map(stripGroup),
  };
}

function stripGroup(skill: CandidateSkill & { group: string }) {
  return {
    id: skill.id,
    skillId: skill.skillId,
    name: skill.name,
    level: skill.level,
    years: skill.years,
    source: skill.source,
    storedYears: skill.storedYears,
  };
}

function SkillEditor({ items, setItems, onDelete }: { items: Array<CandidateSkill & { group: string }>; setItems: (items: Array<CandidateSkill & { group: string }>) => void; onDelete: (target: { label: string; onConfirm: () => void }) => void }) {
  return (
    <Card>
      <SectionHeader title="Kỹ năng" description="Có thể nhập kỹ năng tự do. Nhóm chỉ dùng khi tạo kỹ năng mới; kỹ năng đã có giữ nhóm của danh mục chung." action={<SectionActions onAdd={() => setItems([...items, { id: newId("skill"), name: "", group: "frontend", level: "Cơ bản", years: 0, source: "MANUAL" }])} />} />
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 p-4">
            {item.source && item.source !== "MANUAL" ? <p className="mb-3 text-sm text-slate-600">Nguồn {item.source}: chỉ đọc trong màn hình này, được giữ nguyên khi lưu.</p> : null}
            <fieldset disabled={Boolean(item.source && item.source !== "MANUAL")} className="grid gap-3">
              <Input label="Tên kỹ năng" value={item.name} onChange={(event) => updateItem(items, setItems, item.id, { name: event.target.value, skillId: undefined })} />
              <Select label="Nhóm" value={item.group} disabled={item.skillId != null} onChange={(event) => updateItem(items, setItems, item.id, { group: event.target.value })} options={[{ label: "Frontend", value: "frontend" }, { label: "Backend", value: "backend" }, { label: "Công cụ", value: "tools" }, { label: "Kỹ năng mềm", value: "soft" }]} />
              <Select label="Mức độ" options={[{ label: "Cơ bản", value: "Cơ bản" }, { label: "Khá", value: "Khá" }, { label: "Tốt", value: "Tốt" }]} value={item.level} onChange={(event) => updateItem(items, setItems, item.id, { level: event.target.value })} />
              <Input label="Số năm kinh nghiệm" type="number" min="0" max="999.9" step="0.1" value={item.years} onChange={(event) => updateItem(items, setItems, item.id, { years: Number(event.target.value), storedYears: undefined })} />
              <Button type="button" size="sm" variant="danger" onClick={() => onDelete({ label: "Kỹ năng sẽ bị xóa.", onConfirm: () => setItems(items.filter((entry) => entry.id !== item.id)) })}>Xóa</Button>
            </fieldset>
          </div>
        ))}
      </div>
    </Card>
  );
}

const comparisonLabels: Record<string, string> = { name: "Họ tên", phone: "Số điện thoại", location: "Tỉnh thành", currentTitle: "Chức danh", availability: "Loại hình công việc", summary: "Giới thiệu", careerGoal: "Vị trí mong muốn", preferredLocation: "Địa điểm mong muốn", education: "Học vấn", experience: "Kinh nghiệm", projects: "Dự án", major: "Chuyên ngành", university: "Trường", graduationYear: "Năm tốt nghiệp" };
function skillComparison(items: CandidateSkill[]) { return items.map(skill => `${skill.name} — ${skill.level}, ${skill.years} năm (${skill.source ?? "MANUAL"})`).join("\n") || "(Trống)"; }

function updateItem<T extends { id: string }>(items: T[], setItems: (items: T[]) => void, id: string, payload: Partial<T>) {
  setItems(items.map((item) => item.id === id ? { ...item, ...payload } : item));
}

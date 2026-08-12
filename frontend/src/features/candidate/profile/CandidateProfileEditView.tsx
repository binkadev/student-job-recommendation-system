import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { updateCandidateProfileData } from "./candidateProfileService";
import type { CandidateEducation, CandidateExperience, CandidateProfileData, CandidateProject, CandidateSkill } from "./candidateProfileTypes";

type EditTab = "personal" | "about" | "experience" | "education" | "skills" | "projects";

const tabs: Array<{ label: string; value: EditTab }> = [
  { label: "Thông tin cá nhân", value: "personal" },
  { label: "Giới thiệu", value: "about" },
  { label: "Kinh nghiệm", value: "experience" },
  { label: "Học vấn", value: "education" },
  { label: "Kỹ năng", value: "skills" },
  { label: "Dự án", value: "projects" },
];

const availabilityOptions = [
  { label: "Chọn trạng thái", value: "" },
  { label: "Toàn thời gian", value: "FULL_TIME" },
  { label: "Bán thời gian", value: "PART_TIME" },
  { label: "Thực tập", value: "INTERNSHIP" },
  { label: "Hợp đồng", value: "CONTRACT" },
];

const availabilityLabels: Record<string, string> = {
  FULL_TIME: "Toàn thời gian",
  PART_TIME: "Bán thời gian",
  INTERNSHIP: "Thực tập",
  CONTRACT: "Hợp đồng",
};

const phoneRegex = /^$|^(0|\+84)(\d{9})$/;
const urlSchema = z.string().url("URL không hợp lệ.").or(z.literal(""));

const editSchema = z.object({
  avatar: z.string(),
  name: z.string().min(2, "Vui lòng nhập họ tên."),
  birthDate: z.string(),
  email: z.string().email("Email không hợp lệ."),
  phone: z.string().regex(phoneRegex, "Số điện thoại Việt Nam không hợp lệ."),
  location: z.string(),
  address: z.string(),
  currentTitle: z.string(),
  availability: z.string(),
  summary: z.string().max(1000, "Giới thiệu tối đa 1.000 ký tự."),
  careerGoal: z.string().max(800, "Mục tiêu nghề nghiệp tối đa 800 ký tự."),
  linkedIn: urlSchema,
  github: urlSchema,
  portfolio: urlSchema,
  website: urlSchema,
});

type EditFormValues = z.infer<typeof editSchema>;

interface EditableExperience extends CandidateExperience {
  startDate: string;
  endDate: string;
  current: boolean;
}

interface EditableEducation extends CandidateEducation {
  startDate: string;
  endDate: string;
  description: string;
}

export function CandidateProfileEditView({ profile, onSaved }: { profile: CandidateProfileData; onSaved?: (profile: CandidateProfileData) => void }) {
  const [searchParams] = useSearchParams();
  const initialTab = normalizeTab(searchParams.get("section"));
  const [activeTab, setActiveTab] = useState<EditTab>(initialTab);
  const [experiences, setExperiences] = useState<EditableExperience[]>(toEditableExperiences(profile));
  const [education, setEducation] = useState<EditableEducation[]>(toEditableEducation(profile));
  const [skills, setSkills] = useState(flattenSkills(profile));
  const [projects, setProjects] = useState(profile.projects);
  const [deleteTarget, setDeleteTarget] = useState<{ label: string; onConfirm: () => void } | null>(null);
  const [listError, setListError] = useState("");
  const [savedProfile, setSavedProfile] = useState(profile);
  const { showToast } = useToast();
  const activeTabIndex = tabs.findIndex((tab) => tab.value === activeTab);

  const defaultValues = useMemo<EditFormValues>(() => toEditFormValues(profile), [profile]);

  const { register, handleSubmit, formState: { errors, isDirty, isSubmitting }, reset, getValues } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues,
  });

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  async function saveAll(values: EditFormValues) {
    const validation = validateLists();
    if (validation) {
      setListError(validation);
      return;
    }

    const nextProfile = buildProfile(values);
    const updatedProfile = await updateCandidateProfileData(nextProfile);
    setSavedProfile(updatedProfile);
    setExperiences(toEditableExperiences(updatedProfile));
    setEducation(toEditableEducation(updatedProfile));
    setSkills(flattenSkills(updatedProfile));
    setProjects(updatedProfile.projects);
    onSaved?.(updatedProfile);
    reset(toEditFormValues(updatedProfile));
    setListError("");
    showToast({ type: "success", title: "Đã lưu hồ sơ", message: "Dữ liệu hồ sơ đã được cập nhật từ backend." });
  }

  async function saveCurrentSection() {
    const values = getValues();
    await saveAll(values);
  }

  function cancelChanges() {
    reset(defaultValues);
    setExperiences(toEditableExperiences(profile));
    setEducation(toEditableEducation(profile));
    setSkills(flattenSkills(profile));
    setProjects(profile.projects);
    setListError("");
    showToast({ type: "success", title: "Đã hủy thay đổi" });
  }

  function buildProfile(values: EditFormValues): CandidateProfileData {
    return {
      ...savedProfile,
      header: {
        ...savedProfile.header,
        avatar: values.avatar,
        name: values.name,
        birthDate: values.birthDate,
        email: values.email,
        phone: values.phone,
        location: values.location,
        address: values.address,
        currentTitle: values.currentTitle,
        availability: availabilityLabels[values.availability] ?? "Đang cập nhật",
        preferredJobType: values.availability || null,
        completion: calculateCompletion(values),
      },
      summary: values.summary,
      careerGoal: values.careerGoal,
      experiences: experiences.filter((item) => item.company && item.position).map(({ startDate, endDate, current, ...item }) => ({
        ...item,
        period: startDate ? `${startDate} - ${current ? "Hiện tại" : endDate}` : item.period,
      })),
      education: education.filter((item) => item.school && item.major).map((item) => ({
        id: item.id,
        school: item.school,
        major: item.major,
        degree: item.degree,
        gpa: item.gpa,
        period: item.startDate || item.endDate ? `${item.startDate} - ${item.endDate}` : item.period,
      })),
      skills: groupSkills(skills),
      certificates: savedProfile.certificates,
      projects: projects.filter((item) => item.name && item.role),
      languages: savedProfile.languages,
      links: savedProfile.links,
    };
  }

  function validateLists() {
    const invalidExperience = experiences.some((item) => item.startDate && item.endDate && !item.current && item.endDate < item.startDate);
    if (invalidExperience) return "Ngày kết thúc kinh nghiệm không được trước ngày bắt đầu.";
    const invalidEducation = education.some((item) => item.startDate && item.endDate && item.endDate < item.startDate);
    if (invalidEducation) return "Ngày kết thúc học vấn không được trước ngày bắt đầu.";
    const invalidGpa = education.some((item) => {
      const value = Number(item.gpa);
      return Number.isNaN(value) || value < 0 || value > 10;
    });
    if (invalidGpa) return "GPA phải nằm trong khoảng 0 đến 4 hoặc 0 đến 10.";
    const skillNames = skills.map((item) => item.name.trim().toLowerCase()).filter(Boolean);
    if (new Set(skillNames).size !== skillNames.length) return "Không được thêm kỹ năng trùng tên.";
    return "";
  }

  return (
    <PageContainer>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Chỉnh sửa hồ sơ ứng viên</h1>
          <p className="mt-1 text-sm text-slate-600">Cập nhật thông tin cá nhân, kinh nghiệm, học vấn, kỹ năng và liên kết nghề nghiệp.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={saveCurrentSection} icon={<Save size={16} />}>Lưu mục hiện tại</Button>
          <Button type="button" variant="secondary" onClick={cancelChanges} icon={<X size={16} />}>Hủy thay đổi</Button>
          <Link to="/candidate/profile"><Button type="button" variant="secondary">Xem hồ sơ</Button></Link>
        </div>
      </div>

      <form onSubmit={handleSubmit(saveAll)} className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <div className="grid gap-2">
              {tabs.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setActiveTab(item.value)}
                  className={`flex min-h-10 w-full items-center rounded-md border px-3 text-left text-sm font-medium transition ${
                    activeTab === item.value
                      ? "border-brand-200 bg-brand-50 text-brand-700"
                      : "border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:text-brand-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mt-5">
              <Button className="w-full" type="submit" loading={isSubmitting}>Lưu toàn bộ</Button>
            </div>
            {isDirty ? <p className="mt-3 text-sm text-amber-700">Bạn có thay đổi chưa lưu.</p> : null}
            {listError ? <p className="mt-3 text-sm text-red-600">{listError}</p> : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" disabled={activeTabIndex <= 0} onClick={() => setActiveTab(tabs[Math.max(0, activeTabIndex - 1)].value)}>Trước</Button>
              <Button type="button" variant="secondary" disabled={activeTabIndex >= tabs.length - 1} onClick={() => setActiveTab(tabs[Math.min(tabs.length - 1, activeTabIndex + 1)].value)}>Sau</Button>
            </div>
          </Card>
        </aside>

        <main className="space-y-5">
          {activeTab === "personal" ? (
            <Card>
              <SectionHeader title="Thông tin cá nhân" />
              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Họ tên" error={errors.name?.message} {...register("name")} />
                <Input label="Email" error={errors.email?.message} readOnly {...register("email")} />
                <Input label="Số điện thoại" error={errors.phone?.message} {...register("phone")} />
                <Input label="Tỉnh thành" error={errors.location?.message} {...register("location")} />
                <Input label="Chức danh hiện tại" error={errors.currentTitle?.message} {...register("currentTitle")} />
                <Select label="Trạng thái sẵn sàng làm việc" options={availabilityOptions} error={errors.availability?.message} {...register("availability")} />
              </div>
            </Card>
          ) : null}

          {activeTab === "about" ? (
            <Card>
              <SectionHeader title="Giới thiệu" />
              <div className="grid gap-4">
                <Textarea label="Giới thiệu bản thân" rows={6} error={errors.summary?.message} {...register("summary")} />
                <Textarea label="Mục tiêu nghề nghiệp" rows={5} error={errors.careerGoal?.message} {...register("careerGoal")} />
              </div>
            </Card>
          ) : null}

          {activeTab === "experience" ? <ExperienceEditor items={experiences} setItems={setExperiences} onDelete={setDeleteTarget} /> : null}
          {activeTab === "education" ? <EducationEditor items={education} setItems={setEducation} onDelete={setDeleteTarget} /> : null}
          {activeTab === "skills" ? <SkillEditor items={skills} setItems={setSkills} onDelete={setDeleteTarget} /> : null}
          {activeTab === "projects" ? <ProjectEditor items={projects} setItems={setProjects} onDelete={setDeleteTarget} /> : null}
        </main>
      </form>

      <Modal open={Boolean(deleteTarget)} title="Xóa mục" onClose={() => setDeleteTarget(null)}>
        <ConfirmDialog
          danger
          title="Xóa mục này?"
          description={deleteTarget?.label ?? "Mục này sẽ bị xóa khỏi dữ liệu chỉnh sửa."}
          confirmLabel="Xóa"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            deleteTarget?.onConfirm();
            setDeleteTarget(null);
            setListError("");
          }}
        />
      </Modal>
    </PageContainer>
  );
}

function normalizeTab(section: string | null): EditTab {
  if (section === "summary" || section === "career-goal") return "about";
  if (section === "experience" || section === "education" || section === "skills" || section === "projects") return section;
  return "personal";
}

function toEditFormValues(profile: CandidateProfileData): EditFormValues {
  return {
    avatar: profile.header.avatar,
    name: profile.header.name,
    birthDate: profile.header.birthDate,
    email: profile.header.email,
    phone: profile.header.phone.replaceAll(" ", ""),
    location: profile.header.location,
    address: profile.header.address,
    currentTitle: profile.header.currentTitle,
    availability: profile.header.preferredJobType ?? "",
    summary: profile.summary,
    careerGoal: profile.careerGoal,
    linkedIn: profile.links.linkedIn,
    github: profile.links.github,
    portfolio: profile.links.portfolio,
    website: profile.links.website,
  };
}

function toEditableExperiences(profile: CandidateProfileData): EditableExperience[] {
  return profile.experiences.map((item) => ({ ...item, startDate: "", endDate: "", current: false }));
}

function toEditableEducation(profile: CandidateProfileData): EditableEducation[] {
  return profile.education.map((item) => ({ ...item, startDate: "", endDate: "", description: "" }));
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
  };
}

function calculateCompletion(values: EditFormValues) {
  const filled = Object.values(values).filter(Boolean).length;
  return Math.min(100, Math.round((filled / Object.values(values).length) * 70) + 25);
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

function SectionActions({ onAdd }: { onAdd: () => void }) {
  return <Button type="button" size="sm" variant="secondary" icon={<Plus size={14} />} onClick={onAdd}>Thêm</Button>;
}

function MoveDeleteActions({ onUp, onDown, onDelete }: { onUp: () => void; onDown: () => void; onDelete: () => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="secondary" icon={<ArrowUp size={14} />} onClick={onUp}>Lên</Button>
      <Button type="button" size="sm" variant="secondary" icon={<ArrowDown size={14} />} onClick={onDown}>Xuống</Button>
      <Button type="button" size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={onDelete}>Xóa</Button>
    </div>
  );
}

function swapItems<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

function ExperienceEditor({ items, setItems, onDelete }: { items: EditableExperience[]; setItems: (items: EditableExperience[]) => void; onDelete: (target: { label: string; onConfirm: () => void }) => void }) {
  return (
    <Card>
      <SectionHeader title="Kinh nghiệm" action={<SectionActions onAdd={() => setItems([...items, { id: newId("exp"), company: "", position: "", period: "", startDate: "", endDate: "", current: false, description: "", achievements: [], technologies: [] }])} />} />
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="rounded-lg border border-slate-200 p-4">
            <div className="mb-4 flex justify-end">
              <MoveDeleteActions onUp={() => setItems(swapItems(items, index, -1))} onDown={() => setItems(swapItems(items, index, 1))} onDelete={() => onDelete({ label: "Kinh nghiệm sẽ bị xóa.", onConfirm: () => setItems(items.filter((entry) => entry.id !== item.id)) })} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Công ty" value={item.company} onChange={(event) => updateItem(items, setItems, item.id, { company: event.target.value })} />
              <Input label="Vị trí" value={item.position} onChange={(event) => updateItem(items, setItems, item.id, { position: event.target.value })} />
              <Input label="Ngày bắt đầu" type="date" value={item.startDate} onChange={(event) => updateItem(items, setItems, item.id, { startDate: event.target.value })} />
              <Input label="Ngày kết thúc" type="date" value={item.endDate} disabled={item.current} onChange={(event) => updateItem(items, setItems, item.id, { endDate: event.target.value })} />
              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={item.current} onChange={(event) => updateItem(items, setItems, item.id, { current: event.target.checked })} />Đang làm việc</label>
              <Input label="Công nghệ" value={item.technologies.join(", ")} onChange={(event) => updateItem(items, setItems, item.id, { technologies: splitList(event.target.value) })} />
              <div className="md:col-span-2"><Textarea label="Mô tả" value={item.description} onChange={(event) => updateItem(items, setItems, item.id, { description: event.target.value })} /></div>
              <div className="md:col-span-2"><Textarea label="Thành tựu" value={item.achievements.join("\n")} onChange={(event) => updateItem(items, setItems, item.id, { achievements: splitLines(event.target.value) })} /></div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function EducationEditor({ items, setItems, onDelete }: { items: EditableEducation[]; setItems: (items: EditableEducation[]) => void; onDelete: (target: { label: string; onConfirm: () => void }) => void }) {
  return (
    <Card>
      <SectionHeader title="Học vấn" action={<SectionActions onAdd={() => setItems([...items, { id: newId("edu"), school: "", major: "", degree: "", period: "", startDate: "", endDate: "", gpa: "", description: "" }])} />} />
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 p-4">
            <div className="mb-4 flex justify-end"><Button type="button" size="sm" variant="danger" onClick={() => onDelete({ label: "Học vấn sẽ bị xóa.", onConfirm: () => setItems(items.filter((entry) => entry.id !== item.id)) })}>Xóa</Button></div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Trường" value={item.school} onChange={(event) => updateItem(items, setItems, item.id, { school: event.target.value })} />
              <Input label="Chuyên ngành" value={item.major} onChange={(event) => updateItem(items, setItems, item.id, { major: event.target.value })} />
              <Input label="Bằng cấp" value={item.degree} onChange={(event) => updateItem(items, setItems, item.id, { degree: event.target.value })} />
              <Input label="GPA" value={item.gpa} onChange={(event) => updateItem(items, setItems, item.id, { gpa: event.target.value })} />
              <Input label="Ngày bắt đầu" type="date" value={item.startDate} onChange={(event) => updateItem(items, setItems, item.id, { startDate: event.target.value })} />
              <Input label="Ngày kết thúc" type="date" value={item.endDate} onChange={(event) => updateItem(items, setItems, item.id, { endDate: event.target.value })} />
              <div className="md:col-span-2"><Textarea label="Mô tả" value={item.description} onChange={(event) => updateItem(items, setItems, item.id, { description: event.target.value })} /></div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SkillEditor({ items, setItems, onDelete }: { items: Array<CandidateSkill & { group: string }>; setItems: (items: Array<CandidateSkill & { group: string }>) => void; onDelete: (target: { label: string; onConfirm: () => void }) => void }) {
  return (
    <Card>
      <SectionHeader title="Kỹ năng" description="Có thể nhập kỹ năng tự do. Kỹ năng có trong danh mục sẽ lưu qua API, kỹ năng mới sẽ được giữ lại trên giao diện." action={<SectionActions onAdd={() => setItems([...items, { id: newId("skill"), name: "", group: "frontend", level: "Cơ bản", years: 0, source: "MANUAL" }])} />} />
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 p-4">
            <div className="grid gap-3">
              <Input label="Tên kỹ năng" value={item.name} onChange={(event) => updateItem(items, setItems, item.id, { name: event.target.value, skillId: undefined })} />
              <Select label="Nhóm" value={item.group} onChange={(event) => updateItem(items, setItems, item.id, { group: event.target.value })} options={[{ label: "Frontend", value: "frontend" }, { label: "Backend", value: "backend" }, { label: "Công cụ", value: "tools" }, { label: "Kỹ năng mềm", value: "soft" }]} />
              <Input label="Mức độ" value={item.level} onChange={(event) => updateItem(items, setItems, item.id, { level: event.target.value })} />
              <Input label="Số năm kinh nghiệm" type="number" value={item.years} onChange={(event) => updateItem(items, setItems, item.id, { years: Number(event.target.value) })} />
              <Button type="button" size="sm" variant="danger" onClick={() => onDelete({ label: "Kỹ năng sẽ bị xóa.", onConfirm: () => setItems(items.filter((entry) => entry.id !== item.id)) })}>Xóa</Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ProjectEditor({ items, setItems, onDelete }: { items: CandidateProject[]; setItems: (items: CandidateProject[]) => void; onDelete: (target: { label: string; onConfirm: () => void }) => void }) {
  return (
    <Card>
      <SectionHeader title="Dự án" action={<SectionActions onAdd={() => setItems([...items, { id: newId("project"), name: "", role: "", period: "", description: "", technologies: [], url: "" }])} />} />
      <SimpleGrid items={items} setItems={setItems} onDelete={onDelete} fields={["name", "role", "period", "description", "technologies", "url"]} deleteLabel="Dự án sẽ bị xóa." />
    </Card>
  );
}

function SimpleGrid<T extends { id: string }>({ items, setItems, onDelete, fields, deleteLabel }: { items: T[]; setItems: (items: T[]) => void; onDelete: (target: { label: string; onConfirm: () => void }) => void; fields: string[]; deleteLabel: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-slate-200 p-4">
          <div className="grid gap-3">
            {fields.map((field) => {
              const value = item[field as keyof T];
              const textValue = Array.isArray(value) ? value.join(", ") : String(value ?? "");
              return (
                <Input
                  key={field}
                  label={fieldLabels[field] ?? field}
                  value={textValue}
                  onChange={(event) => {
                    const nextValue = field === "technologies" ? splitList(event.target.value) : event.target.value;
                    updateItem(items, setItems, item.id, { [field]: nextValue } as Partial<T>);
                  }}
                />
              );
            })}
            <Button type="button" size="sm" variant="danger" onClick={() => onDelete({ label: deleteLabel, onConfirm: () => setItems(items.filter((entry) => entry.id !== item.id)) })}>Xóa</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

const fieldLabels: Record<string, string> = {
  name: "Tên",
  issuer: "Tổ chức cấp",
  issuedAt: "Ngày cấp",
  expiresAt: "Ngày hết hạn",
  code: "Mã",
  url: "URL",
  role: "Vai trò",
  period: "Thời gian",
  description: "Mô tả",
  technologies: "Công nghệ",
  level: "Mức độ",
};

function updateItem<T extends { id: string }>(items: T[], setItems: (items: T[]) => void, id: string, payload: Partial<T>) {
  setItems(items.map((item) => item.id === id ? { ...item, ...payload } : item));
}

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function splitLines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

import { Copy, ExternalLink, FileCheck2, MapPin, Pencil, ShieldCheck, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { FileUploader } from "../../components/ui/FileUploader";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Textarea } from "../../components/ui/Textarea";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useLocalStorageState } from "../../hooks/useLocalStorageState";
import { useToast } from "../../hooks/useToast";
import { mockCompanyService, mockJobService } from "../../services/mock";
import type { Company, EntityStatus, Job } from "../../types/domain";

interface RecruiterCompanyPageProps {
  mode?: "view" | "edit" | "verification";
}

const verificationLabels: Record<EntityStatus, string> = {
  active: "Đang hoạt động",
  inactive: "Tạm khóa",
  pending: "Chờ duyệt",
  approved: "Đã xác thực",
  rejected: "Bị từ chối",
  draft: "Chưa gửi",
  closed: "Đã đóng",
};

const verificationDescriptions: Record<EntityStatus, string> = {
  active: "Hồ sơ đang hoạt động nhưng chưa có nhãn xác thực doanh nghiệp.",
  inactive: "Hồ sơ đang bị tạm khóa. Vui lòng liên hệ quản trị viên.",
  pending: "Hồ sơ xác thực đã được gửi và đang chờ duyệt.",
  approved: "Doanh nghiệp đã xác thực. Hồ sơ công khai có badge tin cậy.",
  rejected: "Hồ sơ xác thực bị từ chối. Vui lòng chỉnh sửa và gửi lại.",
  draft: "Bạn chưa gửi hồ sơ xác thực doanh nghiệp.",
  closed: "Hồ sơ doanh nghiệp đã đóng.",
};

const companyTextOverrides: Partial<Company> = {
  name: "Công ty TNHH Công nghệ NovaTech",
  cover: "Nền tảng công nghệ cho doanh nghiệp",
  industry: "Phần mềm doanh nghiệp",
  size: "201-500 nhân sự",
  location: "Hà Nội",
  address: "Tòa nhà Innovation, Cầu Giấy, Hà Nội",
  description: "NovaTech phát triển giải pháp phần mềm quản trị, dữ liệu và tự động hóa cho doanh nghiệp Việt Nam.",
  benefits: ["Lương tháng 13", "Bảo hiểm sức khỏe", "Làm việc hybrid", "Ngân sách học tập"],
};

const branches = [
  { name: "Trụ sở Hà Nội", address: "Tòa nhà Innovation, Cầu Giấy, Hà Nội", team: "Sản phẩm, kỹ thuật, tuyển dụng" },
  { name: "Chi nhánh TP. Hồ Chí Minh", address: "Quận 1, TP. Hồ Chí Minh", team: "Kinh doanh, chăm sóc khách hàng" },
  { name: "Văn phòng Đà Nẵng", address: "Hải Châu, Đà Nẵng", team: "QA, vận hành dự án" },
];

const companyImages = ["Không gian làm việc", "Khu thảo luận nhóm", "Sự kiện nội bộ", "Góc đào tạo"];

const recruitingMembers = [
  { name: "Trần Thị Bình", role: "Recruitment Manager", email: "binh.tran@novatech.vn" },
  { name: "Nguyễn Minh Đức", role: "Talent Acquisition", email: "duc.nguyen@novatech.vn" },
  { name: "Lê Hoàng Phúc", role: "Technical Interviewer", email: "phuc.le@novatech.vn" },
];

interface CompanyEditForm {
  general: {
    name: string;
    shortName: string;
    taxCode: string;
    industry: string;
    size: string;
    foundedYear: string;
    website: string;
    email: string;
    phone: string;
  };
  intro: {
    description: string;
    mission: string;
    coreValues: string;
  };
  images: {
    logo: string;
    cover: string;
    gallery: string[];
  };
  benefits: Array<{ id: string; name: string; description: string; icon: string }>;
  branches: Array<{ id: string; name: string; address: string; province: string; phone: string; isHeadOffice: boolean }>;
  social: {
    linkedin: string;
    facebook: string;
    website: string;
  };
}

export function RecruiterCompanyPage({ mode = "view" }: RecruiterCompanyPageProps) {
  const { showToast } = useToast();
  const companyQuery = useAsyncData(() => mockCompanyService.getCompanyById("company-1"), []);
  const jobsQuery = useAsyncData(() => mockJobService.getJobs({ pageSize: 100 }), []);
  const [company, setCompany] = useState<Company | null>(null);
  const [benefit, setBenefit] = useState("");
  const [mission, setMission] = useState("Giúp doanh nghiệp Việt Nam vận hành hiệu quả hơn bằng nền tảng phần mềm đáng tin cậy, dễ mở rộng và thân thiện với người dùng.");
  const [coreValues, setCoreValues] = useState("Chính trực, học hỏi liên tục, lấy khách hàng làm trung tâm, cộng tác minh bạch và chủ động cải tiến.");

  useEffect(() => {
    if (companyQuery.data) setCompany({ ...companyQuery.data, ...companyTextOverrides });
  }, [companyQuery.data]);

  const companyJobs = useMemo(() => {
    return (jobsQuery.data?.items ?? [])
      .filter((job) => job.companyId === "company-1")
      .map((job) => ({ ...job, companyName: "Công ty TNHH Công nghệ NovaTech" }));
  }, [jobsQuery.data?.items]);

  if (companyQuery.loading || jobsQuery.loading || !company) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  async function saveCompany() {
    if (!company) return;
    await mockCompanyService.updateCompany(company.id, company);
    showToast({ type: "success", title: "Đã lưu hồ sơ công ty" });
  }

  function copyText(label: string, value: string) {
    void navigator.clipboard?.writeText(value);
    showToast({ type: "success", title: `Đã copy ${label}` });
  }

  if (mode === "verification") {
    return <CompanyVerificationView company={company} onCompanyChange={setCompany} />;
  }

  const editing = mode === "edit";

  if (editing) {
    return (
      <RecruiterCompanyEditView
        company={company}
        mission={mission}
        coreValues={coreValues}
        onSaved={(nextCompany, nextMission, nextCoreValues) => {
          setCompany(nextCompany);
          setMission(nextMission);
          setCoreValues(nextCoreValues);
        }}
      />
    );
  }

  return (
    <PageContainer>
      <PageHeader title={editing ? "Chỉnh sửa hồ sơ công ty" : "Hồ sơ công ty"} description="Quản lý thương hiệu tuyển dụng, thông tin doanh nghiệp, phúc lợi, hình ảnh, chi nhánh và tin đang tuyển." />

      <CompanyHero company={company} onCopyWebsite={() => copyText("website", company.website)} onCopyAddress={() => copyText("địa chỉ", company.address)} />

      <div className="mt-5 flex flex-wrap gap-2">
        <Link to="/recruiter/company/edit"><Button icon={<Pencil size={16} />}>Chỉnh sửa</Button></Link>
        <Link to="/recruiter/company/verification"><Button variant="secondary" icon={<ShieldCheck size={16} />}>{getVerificationCta(company.status)}</Button></Link>
        <Link to={`/companies/${company.id}`}><Button variant="secondary" icon={<ExternalLink size={16} />}>Xem trang công khai</Button></Link>
      </div>

      <VerificationNotice company={company} />

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card>
            <SectionHeader title="Giới thiệu" />
            {editing ? (
              <Textarea label="Giới thiệu công ty" value={company.description} onChange={(event) => setCompany({ ...company, description: event.target.value })} />
            ) : (
              <p className="text-sm leading-6 text-slate-700">{company.description}</p>
            )}
          </Card>

          <Card>
            <SectionHeader title="Sứ mệnh" />
            {editing ? <Textarea label="Sứ mệnh" value={mission} onChange={(event) => setMission(event.target.value)} /> : <p className="text-sm leading-6 text-slate-700">{mission}</p>}
          </Card>

          <Card>
            <SectionHeader title="Giá trị cốt lõi" />
            {editing ? <Textarea label="Giá trị cốt lõi" value={coreValues} onChange={(event) => setCoreValues(event.target.value)} /> : <p className="text-sm leading-6 text-slate-700">{coreValues}</p>}
          </Card>

          <CompanyJobsSection jobs={companyJobs} />
          <CompanyBranchesSection />
        </div>

        <aside className="space-y-5">
          <Card>
            <SectionHeader title="Thông tin doanh nghiệp" />
            <div className="grid gap-4">
              <Input label="Tên công ty" disabled={!editing} value={company.name} onChange={(event) => setCompany({ ...company, name: event.target.value })} />
              <Select label="Lĩnh vực" disabled={!editing} value={company.industry} onChange={(event) => setCompany({ ...company, industry: event.target.value })} options={["Phần mềm doanh nghiệp", "Fintech", "E-commerce", "HRTech", "Cloud", "SaaS"].map((value) => ({ label: value, value }))} />
              <Input label="Quy mô" disabled={!editing} value={company.size} onChange={(event) => setCompany({ ...company, size: event.target.value })} />
              <Input label="Website" disabled={!editing} value={company.website} onChange={(event) => setCompany({ ...company, website: event.target.value })} />
              <Input label="Trụ sở" disabled={!editing} value={company.address} onChange={(event) => setCompany({ ...company, address: event.target.value })} />
            </div>
            {editing ? (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={() => void saveCompany()}>Lưu hồ sơ</Button>
                <FileUploader label="Upload logo/cover giả lập" onFileSelect={() => showToast({ type: "success", title: "Đã upload hình ảnh giả lập" })} />
              </div>
            ) : null}
          </Card>

          <BenefitsCard company={company} editing={editing} benefit={benefit} onBenefitChange={setBenefit} onCompanyChange={setCompany} />
          <CompanyImagesCard />
          <RecruitingMembersCard />
        </aside>
      </div>
    </PageContainer>
  );
}

function CompanyHero({ company, onCopyWebsite, onCopyAddress }: { company: Company; onCopyWebsite: () => void; onCopyAddress: () => void }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex min-h-48 items-end bg-slate-950 p-6 text-white">
        <div className="max-w-3xl">
          <p className="text-sm text-slate-300">{company.cover}</p>
          <h1 className="mt-2 text-3xl font-semibold">{company.name}</h1>
        </div>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4 p-6">
        <div className="flex gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xl font-semibold text-brand-700">{company.logo}</div>
          <div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={company.verified ? "Đã xác thực" : verificationLabels[company.status]} tone={company.verified ? "success" : company.status === "pending" ? "warning" : company.status === "rejected" ? "danger" : "neutral"} />
              <StatusBadge label={company.industry} />
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
              <span>Website: <strong>{company.website}</strong></span>
              <span>Trụ sở: <strong>{company.address}</strong></span>
              <span>Quy mô: <strong>{company.size}</strong></span>
              <span>Lĩnh vực: <strong>{company.industry}</strong></span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<Copy size={16} />} onClick={onCopyWebsite}>Copy website</Button>
          <Button variant="secondary" icon={<MapPin size={16} />} onClick={onCopyAddress}>Copy địa chỉ</Button>
        </div>
      </div>
    </section>
  );
}

function RecruiterCompanyEditView({
  company,
  mission,
  coreValues,
  onSaved,
}: {
  company: Company;
  mission: string;
  coreValues: string;
  onSaved: (company: Company, mission: string, coreValues: string) => void;
}) {
  const { showToast } = useToast();
  const [savedDraft, setSavedDraft] = useLocalStorageState<CompanyEditForm | null>("recruiter-company-edit-draft", null);
  const [form, setForm] = useState<CompanyEditForm>(() => savedDraft ?? buildCompanyEditForm(company, mission, coreValues));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  function updateForm(nextForm: CompanyEditForm) {
    setForm(nextForm);
    setSavedDraft(nextForm);
    setDirty(true);
  }

  function updateGeneral<K extends keyof CompanyEditForm["general"]>(key: K, value: CompanyEditForm["general"][K]) {
    updateForm({ ...form, general: { ...form.general, [key]: value } });
  }

  function updateIntro<K extends keyof CompanyEditForm["intro"]>(key: K, value: CompanyEditForm["intro"][K]) {
    updateForm({ ...form, intro: { ...form.intro, [key]: value } });
  }

  function updateImages<K extends keyof CompanyEditForm["images"]>(key: K, value: CompanyEditForm["images"][K]) {
    updateForm({ ...form, images: { ...form.images, [key]: value } });
  }

  function updateSocial<K extends keyof CompanyEditForm["social"]>(key: K, value: CompanyEditForm["social"][K]) {
    updateForm({ ...form, social: { ...form.social, [key]: value } });
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (!form.general.name.trim()) nextErrors.name = "Tên công ty bắt buộc.";
    if (!/^[0-9]{8,14}$/.test(form.general.taxCode.trim())) nextErrors.taxCode = "Mã số thuế cần gồm 8-14 chữ số.";
    if (!isValidUrl(form.general.website)) nextErrors.website = "Website không hợp lệ.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.general.email)) nextErrors.email = "Email không hợp lệ.";
    if (form.social.linkedin && !isValidUrl(form.social.linkedin)) nextErrors.linkedin = "LinkedIn phải là URL hợp lệ.";
    if (form.social.facebook && !isValidUrl(form.social.facebook)) nextErrors.facebook = "Facebook phải là URL hợp lệ.";
    if (!form.branches.some((branch) => branch.isHeadOffice)) nextErrors.branches = "Phải có một trụ sở chính.";
    if (form.branches.filter((branch) => branch.isHeadOffice).length > 1) nextErrors.branches = "Không cho hai chi nhánh cùng là trụ sở chính.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function save() {
    if (!validate()) return;
    const nextCompany: Company = {
      ...company,
      name: form.general.name,
      logo: form.images.logo,
      cover: form.images.cover,
      industry: form.general.industry,
      size: form.general.size,
      website: form.general.website,
      address: form.branches.find((branch) => branch.isHeadOffice)?.address ?? company.address,
      location: form.branches.find((branch) => branch.isHeadOffice)?.province ?? company.location,
      description: form.intro.description,
      benefits: form.benefits.map((benefit) => benefit.name),
    };
    await mockCompanyService.updateCompany(company.id, nextCompany);
    setSavedDraft(form);
    setDirty(false);
    onSaved(nextCompany, form.intro.mission, form.intro.coreValues);
    showToast({ type: "success", title: "Đã lưu hồ sơ công ty" });
  }

  function cancel() {
    if (dirty && !window.confirm("Bạn có thay đổi chưa lưu. Bạn có chắc muốn hủy?")) return;
    window.history.back();
  }

  return (
    <PageContainer>
      <PageHeader title="Chỉnh sửa hồ sơ công ty" description="Cập nhật thông tin chung, giới thiệu, hình ảnh, phúc lợi, chi nhánh và social links." />
      <div className="mb-5 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={() => setPreviewOpen(true)}>Preview</Button>
        <Button variant="secondary" onClick={cancel}>Cancel</Button>
        <Button onClick={() => void save()}>Save</Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Card>
            <SectionHeader title="Thông tin chung" />
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Tên công ty" value={form.general.name} error={errors.name} onChange={(event) => updateGeneral("name", event.target.value)} />
              <Input label="Tên viết tắt" value={form.general.shortName} onChange={(event) => updateGeneral("shortName", event.target.value)} />
              <Input label="Mã số thuế" value={form.general.taxCode} error={errors.taxCode} onChange={(event) => updateGeneral("taxCode", event.target.value)} />
              <Select label="Lĩnh vực" value={form.general.industry} onChange={(event) => updateGeneral("industry", event.target.value)} options={["Phần mềm doanh nghiệp", "Fintech", "E-commerce", "HRTech", "Cloud", "SaaS"].map((value) => ({ label: value, value }))} />
              <Input label="Quy mô" value={form.general.size} onChange={(event) => updateGeneral("size", event.target.value)} />
              <Input label="Năm thành lập" value={form.general.foundedYear} onChange={(event) => updateGeneral("foundedYear", event.target.value)} />
              <Input label="Website" value={form.general.website} error={errors.website} onChange={(event) => updateGeneral("website", event.target.value)} />
              <Input label="Email" value={form.general.email} error={errors.email} onChange={(event) => updateGeneral("email", event.target.value)} />
              <Input label="Số điện thoại" value={form.general.phone} onChange={(event) => updateGeneral("phone", event.target.value)} />
            </div>
          </Card>

          <Card>
            <SectionHeader title="Giới thiệu" />
            <div className="space-y-4">
              <Textarea label="Mô tả" value={form.intro.description} onChange={(event) => updateIntro("description", event.target.value)} />
              <Textarea label="Sứ mệnh" value={form.intro.mission} onChange={(event) => updateIntro("mission", event.target.value)} />
              <Textarea label="Giá trị cốt lõi" value={form.intro.coreValues} onChange={(event) => updateIntro("coreValues", event.target.value)} />
            </div>
          </Card>

          <CompanyEditImages form={form} onUpdate={updateImages} />
          <CompanyEditBenefits benefits={form.benefits} onChange={(benefits) => updateForm({ ...form, benefits })} />
          <CompanyEditBranches branches={form.branches} error={errors.branches} onChange={(branches) => updateForm({ ...form, branches })} />
        </div>

        <aside className="space-y-5">
          <Card>
            <SectionHeader title="Social links" />
            <div className="space-y-4">
              <Input label="LinkedIn" value={form.social.linkedin} error={errors.linkedin} onChange={(event) => updateSocial("linkedin", event.target.value)} />
              <Input label="Facebook" value={form.social.facebook} error={errors.facebook} onChange={(event) => updateSocial("facebook", event.target.value)} />
              <Input label="Website" value={form.social.website} onChange={(event) => updateSocial("website", event.target.value)} />
            </div>
          </Card>
          <CompanyEditPreview form={form} compact />
        </aside>
      </div>

      <PreviewModal open={previewOpen} form={form} onClose={() => setPreviewOpen(false)} />
    </PageContainer>
  );
}

function CompanyEditImages({ form, onUpdate }: { form: CompanyEditForm; onUpdate: <K extends keyof CompanyEditForm["images"]>(key: K, value: CompanyEditForm["images"][K]) => void }) {
  return (
    <Card>
      <SectionHeader title="Hình ảnh" description="Upload giả lập sẽ cập nhật preview bằng tên file." />
      <div className="grid gap-4 md:grid-cols-2">
        <FileUploader label={`Logo: ${form.images.logo}`} accept=".png,.jpg,.jpeg" onFileSelect={(file) => onUpdate("logo", file.name.slice(0, 2).toUpperCase())} />
        <FileUploader label={`Cover: ${form.images.cover}`} accept=".png,.jpg,.jpeg" onFileSelect={(file) => onUpdate("cover", file.name)} />
      </div>
      <div className="mt-4">
        <FileUploader label="Thêm ảnh gallery giả lập" accept=".png,.jpg,.jpeg" onFileSelect={(file) => onUpdate("gallery", [...form.images.gallery, file.name])} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {form.images.gallery.map((image) => (
          <div key={image} className="rounded-lg border border-slate-100 p-3">
            <div className="flex aspect-video items-center justify-center rounded-md bg-slate-100 text-sm text-slate-500">{image}</div>
            <Button className="mt-2 w-full" variant="secondary" size="sm" onClick={() => onUpdate("gallery", form.images.gallery.filter((item) => item !== image))}>Xóa</Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CompanyEditBenefits({ benefits, onChange }: { benefits: CompanyEditForm["benefits"]; onChange: (benefits: CompanyEditForm["benefits"]) => void }) {
  const emptyBenefit = { id: "", name: "", description: "", icon: "" };
  const [draft, setDraft] = useState(emptyBenefit);

  function saveDraft() {
    if (!draft.name.trim()) return;
    if (draft.id) {
      onChange(benefits.map((benefit) => (benefit.id === draft.id ? draft : benefit)));
    } else {
      onChange([...benefits, { ...draft, id: `benefit-${Date.now()}` }]);
    }
    setDraft(emptyBenefit);
  }

  return (
    <Card>
      <SectionHeader title="Phúc lợi" description="Thêm, sửa, xóa tên phúc lợi, mô tả và icon." />
      <div className="grid gap-3 md:grid-cols-3">
        <Input label="Tên phúc lợi" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        <Input label="Mô tả" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
        <Input label="Icon" value={draft.icon} onChange={(event) => setDraft({ ...draft, icon: event.target.value })} />
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={saveDraft}>{draft.id ? "Lưu phúc lợi" : "Thêm phúc lợi"}</Button>
        {draft.id ? <Button variant="secondary" size="sm" onClick={() => setDraft(emptyBenefit)}>Hủy sửa</Button> : null}
      </div>
      <div className="mt-4 space-y-3">
        {benefits.map((benefit) => (
          <div key={benefit.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
            <div>
              <p className="font-medium text-slate-900">{benefit.icon} {benefit.name}</p>
              <p className="text-sm text-slate-600">{benefit.description}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDraft(benefit)}>Sửa</Button>
              <Button variant="danger" size="sm" onClick={() => onChange(benefits.filter((item) => item.id !== benefit.id))}>Xóa</Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CompanyEditBranches({ branches, error, onChange }: { branches: CompanyEditForm["branches"]; error?: string; onChange: (branches: CompanyEditForm["branches"]) => void }) {
  const emptyBranch = { id: "", name: "", address: "", province: "", phone: "", isHeadOffice: false };
  const [draft, setDraft] = useState(emptyBranch);

  function saveDraft() {
    if (!draft.name.trim() || !draft.address.trim()) return;
    const nextDraft = draft.isHeadOffice ? { ...draft, isHeadOffice: true } : draft;
    if (draft.id) {
      onChange(branches.map((branch) => (branch.id === draft.id ? nextDraft : draft.isHeadOffice ? { ...branch, isHeadOffice: false } : branch)));
    } else {
      onChange([...(draft.isHeadOffice ? branches.map((branch) => ({ ...branch, isHeadOffice: false })) : branches), { ...nextDraft, id: `branch-${Date.now()}` }]);
    }
    setDraft(emptyBranch);
  }

  return (
    <Card>
      <SectionHeader title="Chi nhánh" description="Thêm, sửa, xóa chi nhánh. Chỉ một chi nhánh được là trụ sở chính." />
      <div className="grid gap-3 md:grid-cols-2">
        <Input label="Tên" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        <Input label="Tỉnh thành" value={draft.province} onChange={(event) => setDraft({ ...draft, province: event.target.value })} />
        <Input label="Địa chỉ" value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} />
        <Input label="Số điện thoại" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={draft.isHeadOffice} onChange={(event) => setDraft({ ...draft, isHeadOffice: event.target.checked })} />
        Trụ sở chính
      </label>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={saveDraft}>{draft.id ? "Lưu chi nhánh" : "Thêm chi nhánh"}</Button>
        {draft.id ? <Button variant="secondary" size="sm" onClick={() => setDraft(emptyBranch)}>Hủy sửa</Button> : null}
      </div>
      <div className="mt-4 space-y-3">
        {branches.map((branch) => (
          <div key={branch.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
            <div>
              <p className="font-medium text-slate-900">{branch.name} {branch.isHeadOffice ? "· Trụ sở chính" : ""}</p>
              <p className="text-sm text-slate-600">{branch.address}, {branch.province}</p>
              <p className="text-xs text-slate-500">{branch.phone}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDraft(branch)}>Sửa</Button>
              <Button variant="danger" size="sm" onClick={() => onChange(branches.filter((item) => item.id !== branch.id))}>Xóa</Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CompanyEditPreview({ form, compact = false }: { form: CompanyEditForm; compact?: boolean }) {
  return (
    <Card>
      <SectionHeader title="Preview" description={compact ? "Xem nhanh hồ sơ công ty." : "Bản xem trước hồ sơ công ty trước khi lưu."} />
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="flex min-h-28 items-end bg-slate-950 p-4 text-white">
          <div>
            <p className="text-xs text-slate-300">{form.images.cover}</p>
            <h3 className="mt-1 text-lg font-semibold">{form.general.name}</h3>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 font-semibold text-brand-700">{form.images.logo}</div>
            <div>
              <p className="font-medium text-slate-950">{form.general.shortName || form.general.name}</p>
              <p className="text-sm text-slate-600">{form.general.industry} · {form.general.size}</p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-700">{form.intro.description}</p>
        </div>
      </div>
    </Card>
  );
}

function PreviewModal({ open, form, onClose }: { open: boolean; form: CompanyEditForm; onClose: () => void }) {
  return (
    <Modal open={open} title="Preview hồ sơ công ty" onClose={onClose} size="lg">
      <CompanyEditPreview form={form} />
    </Modal>
  );
}

function buildCompanyEditForm(company: Company, mission: string, coreValues: string): CompanyEditForm {
  return {
    general: {
      name: company.name,
      shortName: company.logo,
      taxCode: "0109998888",
      industry: company.industry,
      size: company.size,
      foundedYear: "2018",
      website: company.website,
      email: "recruiter@example.com",
      phone: "0901 222 333",
    },
    intro: {
      description: company.description,
      mission,
      coreValues,
    },
    images: {
      logo: company.logo,
      cover: company.cover,
      gallery: ["van-phong.jpg", "team-building.jpg", "training-room.jpg"],
    },
    benefits: company.benefits.map((name, index) => ({
      id: `benefit-${index}`,
      name,
      description: "Phúc lợi dành cho nhân sự của công ty.",
      icon: ["Briefcase", "Health", "Hybrid", "Learning"][index] ?? "Benefit",
    })),
    branches: [
      { id: "branch-1", name: "Trụ sở Hà Nội", address: company.address, province: company.location, phone: "024 1234 5678", isHeadOffice: true },
      { id: "branch-2", name: "Chi nhánh TP. Hồ Chí Minh", address: "Quận 1", province: "TP. Hồ Chí Minh", phone: "028 1234 5678", isHeadOffice: false },
    ],
    social: {
      linkedin: "https://linkedin.com/company/novatech",
      facebook: "https://facebook.com/novatech",
      website: company.website,
    },
  };
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function VerificationNotice({ company }: { company: Company }) {
  return (
    <Card className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionHeader title="Trạng thái xác thực" description={verificationDescriptions[company.status]} />
          <StatusBadge label={verificationLabels[company.status]} tone={company.status === "approved" ? "success" : company.status === "pending" ? "warning" : company.status === "rejected" ? "danger" : "neutral"} />
        </div>
        <Link to="/recruiter/company/verification"><Button variant={company.status === "approved" ? "secondary" : "primary"}>{getVerificationCta(company.status)}</Button></Link>
      </div>
    </Card>
  );
}

function BenefitsCard({ company, editing, benefit, onBenefitChange, onCompanyChange }: { company: Company; editing: boolean; benefit: string; onBenefitChange: (value: string) => void; onCompanyChange: (company: Company) => void }) {
  return (
    <Card>
      <SectionHeader title="Phúc lợi" />
      <div className="flex flex-wrap gap-2">
        {company.benefits.map((item) => (
          <button key={item} disabled={!editing} onClick={() => onCompanyChange({ ...company, benefits: company.benefits.filter((benefitItem) => benefitItem !== item) })}>
            <StatusBadge label={item} tone="success" />
          </button>
        ))}
      </div>
      {editing ? (
        <div className="mt-4 flex gap-2">
          <Input label="Thêm phúc lợi" value={benefit} onChange={(event) => onBenefitChange(event.target.value)} />
          <Button className="self-end" onClick={() => { if (benefit.trim()) onCompanyChange({ ...company, benefits: [...company.benefits, benefit.trim()] }); onBenefitChange(""); }}>Thêm</Button>
        </div>
      ) : null}
    </Card>
  );
}

function CompanyBranchesSection() {
  return (
    <Card>
      <SectionHeader title="Chi nhánh" />
      <div className="grid gap-3 md:grid-cols-3">
        {branches.map((branch) => (
          <div key={branch.name} className="rounded-lg border border-slate-100 p-3">
            <p className="font-medium text-slate-900">{branch.name}</p>
            <p className="mt-1 text-sm text-slate-600">{branch.address}</p>
            <p className="mt-2 text-xs text-slate-500">{branch.team}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CompanyImagesCard() {
  return (
    <Card>
      <SectionHeader title="Hình ảnh" />
      <div className="grid gap-3">
        {companyImages.map((item) => (
          <div key={item} className="flex aspect-video items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-500">{item}</div>
        ))}
      </div>
    </Card>
  );
}

function CompanyJobsSection({ jobs }: { jobs: Job[] }) {
  return (
    <Card>
      <SectionHeader title="Tin đang tuyển" />
      <div className="space-y-3">
        {jobs.slice(0, 5).map((job) => (
          <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
            <div>
              <p className="font-medium text-slate-900">{job.title}</p>
              <p className="text-sm text-slate-500">{job.location} · {job.salary} · {job.applicants} ứng viên</p>
            </div>
            <Link to={`/recruiter/jobs/${job.id}`}><Button variant="secondary" size="sm">Mở tin tuyển dụng</Button></Link>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RecruitingMembersCard() {
  return (
    <Card>
      <SectionHeader title="Thành viên tuyển dụng" />
      <div className="space-y-3">
        {recruitingMembers.map((member) => (
          <div key={member.email} className="rounded-lg border border-slate-100 p-3">
            <p className="font-medium text-slate-900">{member.name}</p>
            <p className="text-sm text-slate-600">{member.role}</p>
            <p className="text-xs text-slate-500">{member.email}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CompanyVerificationView({ company, onCompanyChange }: { company: Company; onCompanyChange: (company: Company) => void }) {
  const { showToast } = useToast();

  return (
    <PageContainer>
      <PageHeader title="Xác thực doanh nghiệp" description="Gửi thông tin pháp lý, giấy phép kinh doanh giả lập và theo dõi trạng thái xác thực." />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Mã số thuế" defaultValue="0109998888" />
            <Input label="Người đại diện" defaultValue="Trần Thị Bình" />
            <Input label="Chức vụ" defaultValue="Recruitment Manager" />
            <Input label="Email liên hệ" defaultValue="recruiter@example.com" />
          </div>
          <div className="mt-5">
            <FileUploader label="Tải giấy phép kinh doanh giả lập" accept=".pdf,.png,.jpg" onFileSelect={() => showToast({ type: "success", title: "Đã chọn tài liệu xác thực" })} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button icon={<UploadCloud size={16} />} onClick={() => { onCompanyChange({ ...company, status: "pending", verified: false }); showToast({ type: "success", title: "Đã gửi xác thực doanh nghiệp" }); }}>Gửi xác thực</Button>
            <Button variant="secondary" onClick={() => showToast({ type: "success", title: "Đã lưu nháp xác thực" })}>Lưu nháp</Button>
          </div>
        </Card>
        <Card>
          <SectionHeader title="Trạng thái xác thực" />
          <StatusBadge label={verificationLabels[company.status]} tone={company.status === "approved" ? "success" : company.status === "pending" ? "warning" : company.status === "rejected" ? "danger" : "neutral"} />
          <p className="mt-4 text-sm text-slate-600">{verificationDescriptions[company.status]}</p>
          <div className="mt-5">
            <Link to="/recruiter/company"><Button variant="secondary" icon={<FileCheck2 size={16} />}>Quay lại hồ sơ công ty</Button></Link>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

function getVerificationCta(status: EntityStatus) {
  if (status === "approved") return "Xem xác thực";
  if (status === "pending") return "Theo dõi xác thực";
  if (status === "rejected") return "Gửi lại xác thực";
  return "Mở xác thực doanh nghiệp";
}

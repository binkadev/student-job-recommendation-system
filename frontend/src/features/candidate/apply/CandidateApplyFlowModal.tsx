import { CheckCircle2, FileUp, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SectionHeader } from "../../../components/common/SectionHeader";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Checkbox } from "../../../components/ui/Checkbox";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";
import { Stepper } from "../../../components/ui/Stepper";
import { Textarea } from "../../../components/ui/Textarea";
import { useAsyncData } from "../../../hooks/useAsyncData";
import { useToast } from "../../../hooks/useToast";
import { httpClient } from "../../../services/api/httpClient";
import type { Cv } from "../../../types/domain";
import { useAppliedJobs } from "../../public/jobs/useAppliedJobs";

export interface ApplyFlowJob {
  id: string;
  title: string;
  companyName: string;
  salary?: string;
  location?: string;
  workMode?: string;
}

interface ScreeningAnswers {
  years: string;
  startDate: string;
  salary: string;
  onsite: string;
}

const steps = ["Chọn CV", "Thư giới thiệu", "Câu hỏi sàng lọc", "Xem lại", "Thành công"];
const coverTemplate =
  "Kính gửi nhà tuyển dụng, em quan tâm đến vị trí này vì công việc phù hợp với kỹ năng, định hướng nghề nghiệp và kinh nghiệm dự án hiện tại. Em mong có cơ hội trao đổi thêm để trình bày rõ hơn về năng lực của mình.";

const cvStatusLabels: Record<Cv["status"], { label: string; tone: "neutral" | "success" | "warning" | "danger" }> = {
  uploaded: { label: "Đã tải lên", tone: "neutral" },
  analyzing: { label: "Đang phân tích", tone: "warning" },
  analyzed: { label: "Đã phân tích", tone: "success" },
  failed: { label: "Lỗi phân tích", tone: "danger" },
  needs_confirmation: { label: "Cần xác nhận", tone: "warning" },
};

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

interface BackendCvFileResponse {
  id: number;
  originalFileName?: string | null;
  storedFileName?: string | null;
  filePath?: string | null;
  contentType?: string | null;
  fileSize?: number | null;
  active: boolean;
  uploadedAt?: string | null;
}

interface BackendApplicationResponse {
  id: number;
}

export function CandidateApplyFlowModal({ job, onClose }: { job: ApplyFlowJob | null; onClose: () => void }) {
  const open = Boolean(job);
  const cvsQuery = useAsyncData(() => getSelectableCvs(open), [open]);
  const { hasApplied, applyToJob } = useAppliedJobs();
  const { showToast } = useToast();
  const [step, setStep] = useState(0);
  const [selectedCvId, setSelectedCvId] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [answers, setAnswers] = useState<ScreeningAnswers>({ years: "", startDate: "", salary: "", onsite: "" });
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applicationCode, setApplicationCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const cvs = useMemo(() => cvsQuery.data?.items ?? [], [cvsQuery.data?.items]);
  const selectableCvs = useMemo(() => cvs.filter((cv) => !["analyzing", "failed"].includes(cv.status)), [cvs]);
  const selectedCv = cvs.find((cv) => cv.id === selectedCvId) ?? null;
  const dirty = step > 0 || Boolean(selectedCvId || coverLetter || answers.years || answers.startDate || answers.salary || answers.onsite);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setCoverLetter("");
    setAnswers({ years: "", startDate: "", salary: "", onsite: "" });
    setConfirmed(false);
    setSubmitting(false);
    setApplicationCode("");
    setErrors({});
  }, [open, job?.id]);

  useEffect(() => {
    if (!open || selectedCvId || selectableCvs.length === 0) return;
    const defaultCv = selectableCvs.find((cv) => cv.isDefault) ?? selectableCvs[0];
    setSelectedCvId(defaultCv.id);
  }, [open, selectableCvs, selectedCvId]);

  function requestClose() {
    if (submitting) return;
    if (dirty && step < 4 && !window.confirm("Bạn đang ứng tuyển dở. Đóng luồng này sẽ mất dữ liệu chưa gửi. Tiếp tục đóng?")) return;
    onClose();
  }

  function validateStep(currentStep = step) {
    const nextErrors: Record<string, string> = {};
    if (currentStep === 0) {
      if (!selectedCvId) nextErrors.cv = "Vui lòng chọn một CV.";
      if (selectedCv && ["analyzing", "failed"].includes(selectedCv.status)) nextErrors.cv = "Không thể chọn CV đang phân tích hoặc lỗi.";
    }
    if (currentStep === 2) {
      if (!answers.years.trim()) nextErrors.years = "Vui lòng nhập số năm kinh nghiệm.";
      if (answers.years.trim() && (Number.isNaN(Number(answers.years)) || Number(answers.years) < 0)) nextErrors.years = "Số năm kinh nghiệm phải là số hợp lệ.";
      if (!answers.startDate) nextErrors.startDate = "Vui lòng chọn ngày có thể bắt đầu.";
      if (!answers.salary.trim()) nextErrors.salary = "Vui lòng nhập mức lương mong muốn.";
      if (answers.salary.trim() && (Number.isNaN(Number(answers.salary)) || Number(answers.salary) <= 0)) nextErrors.salary = "Mức lương phải là số hợp lệ.";
      if (!answers.onsite) nextErrors.onsite = "Vui lòng chọn câu trả lời.";
    }
    if (currentStep === 3 && !confirmed) nextErrors.confirmed = "Bạn cần xác nhận thông tin chính xác trước khi gửi.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function nextStep() {
    if (!validateStep()) return;
    setStep((current) => Math.min(3, current + 1));
  }

  async function submitApplication() {
    if (!job || !validateStep(3)) return;
    if (hasApplied(job.id)) {
      showToast({ type: "error", title: "Không thể ứng tuyển trùng", message: "Bạn đã ứng tuyển việc làm này trước đó." });
      return;
    }
    setSubmitting(true);
    try {
      const response = await httpClient.post<ApiResponse<BackendApplicationResponse>>(`/jobs/${job.id}/apply`, {
        cvFileId: selectedCvId ? Number(selectedCvId) : null,
        coverLetter: coverLetter.trim() || null,
      });
      const code = `APP-${response.data.data.id}`;
      applyToJob(job.id);
      setApplicationCode(code);
      setStep(4);
      showToast({ type: "success", title: "Ứng tuyển thành công", message: `Mã ứng tuyển của bạn là ${code}.` });
    } catch {
      showToast({ type: "error", title: "Không thể gửi ứng tuyển", message: "Vui lòng kiểm tra CV đã chọn hoặc thử lại sau." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} title={`Ứng tuyển ${job?.title ?? ""}`} onClose={requestClose} size="lg">
      <Stepper steps={steps} currentStep={step} />
      <div className="mt-5 max-h-[70vh] overflow-y-auto pr-1">
        {cvsQuery.loading && step === 0 ? <LoadingState /> : null}
        {!cvsQuery.loading && step === 0 ? (
          <CvStep cvs={cvs} selectedCvId={selectedCvId} error={errors.cv} onSelect={setSelectedCvId} />
        ) : null}
        {step === 1 ? (
          <CoverLetterStep coverLetter={coverLetter} onChange={setCoverLetter} onUseTemplate={() => setCoverLetter(coverTemplate)} />
        ) : null}
        {step === 2 ? <ScreeningStep answers={answers} errors={errors} onChange={setAnswers} /> : null}
        {step === 3 && job ? (
          <ReviewStep job={job} cv={selectedCv} coverLetter={coverLetter} answers={answers} confirmed={confirmed} error={errors.confirmed} onConfirm={setConfirmed} />
        ) : null}
        {step === 4 ? <SuccessStep applicationCode={applicationCode} /> : null}
      </div>

      {step < 4 ? (
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={requestClose}>Đóng</Button>
          {step > 0 ? <Button variant="secondary" onClick={() => setStep((current) => current - 1)} disabled={submitting}>Quay lại</Button> : null}
          {step < 3 ? <Button onClick={nextStep}>Tiếp tục</Button> : null}
          {step === 3 ? <Button onClick={submitApplication} loading={submitting} disabled={submitting}>Gửi ứng tuyển</Button> : null}
        </div>
      ) : null}
    </Modal>
  );
}

function CvStep({ cvs, selectedCvId, error, onSelect }: { cvs: Cv[]; selectedCvId: string; error?: string; onSelect: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <SectionHeader title="Chọn CV" description="Chọn một CV đã phân tích thành công hoặc cần xác nhận. CV đang phân tích hoặc lỗi sẽ bị khóa." />
      <div className="grid gap-3">
        {cvs.map((cv) => {
          const status = cvStatusLabels[cv.status];
          const disabled = ["analyzing", "failed"].includes(cv.status);
          return (
            <button
              key={cv.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(cv.id)}
              className={`rounded-lg border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${selectedCvId === cv.id ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-200"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{cv.fileName}</p>
                  <p className="mt-1 text-sm text-slate-600">Cập nhật ngày {formatDate(cv.uploadedAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cv.isDefault ? <StatusBadge label="CV mặc định" tone="success" /> : null}
                  <StatusBadge label={`${cv.score} điểm`} />
                  <StatusBadge label={status.label} tone={status.tone} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Link to="/candidate/cvs/upload">
        <Button variant="secondary" icon={<FileUp size={16} />}>Upload CV mới</Button>
      </Link>
    </div>
  );
}

function CoverLetterStep({ coverLetter, onChange, onUseTemplate }: { coverLetter: string; onChange: (value: string) => void; onUseTemplate: () => void }) {
  return (
    <div className="space-y-4">
      <SectionHeader title="Thư giới thiệu" description="Bạn có thể tự viết hoặc bấm dùng mẫu gợi ý. Nội dung mẫu chỉ được thêm khi bạn xác nhận bằng nút bên dưới." />
      <Textarea label="Nội dung thư giới thiệu" value={coverLetter} maxLength={1500} onChange={(event) => onChange(event.target.value)} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">{coverLetter.length}/1.500 ký tự</p>
        <Button variant="secondary" onClick={onUseTemplate}>Dùng mẫu thư gợi ý</Button>
      </div>
    </div>
  );
}

function ScreeningStep({ answers, errors, onChange }: { answers: ScreeningAnswers; errors: Record<string, string>; onChange: (answers: ScreeningAnswers) => void }) {
  function update(key: keyof ScreeningAnswers, value: string) {
    onChange({ ...answers, [key]: value });
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Câu hỏi sàng lọc" description="Các câu hỏi bắt buộc giúp nhà tuyển dụng đánh giá nhanh mức độ phù hợp." />
      <Input label="Bạn có bao nhiêu năm kinh nghiệm?" type="number" min="0" value={answers.years} error={errors.years} onChange={(event) => update("years", event.target.value)} />
      <Input label="Khi nào bạn có thể bắt đầu?" type="date" value={answers.startDate} error={errors.startDate} onChange={(event) => update("startDate", event.target.value)} />
      <Input label="Mức lương mong muốn? (triệu đồng)" type="number" min="1" value={answers.salary} error={errors.salary} onChange={(event) => update("salary", event.target.value)} />
      <Select
        label="Bạn có sẵn sàng onsite 3 ngày mỗi tuần không?"
        value={answers.onsite}
        error={errors.onsite}
        onChange={(event) => update("onsite", event.target.value)}
        options={[
          { label: "Chọn câu trả lời", value: "" },
          { label: "Có", value: "Có" },
          { label: "Không", value: "Không" },
          { label: "Có thể trao đổi thêm", value: "Có thể trao đổi thêm" },
        ]}
      />
    </div>
  );
}

function ReviewStep({
  job,
  cv,
  coverLetter,
  answers,
  confirmed,
  error,
  onConfirm,
}: {
  job: ApplyFlowJob;
  cv: Cv | null;
  coverLetter: string;
  answers: ScreeningAnswers;
  confirmed: boolean;
  error?: string;
  onConfirm: (checked: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader title="Xem lại hồ sơ ứng tuyển" description="Kiểm tra thông tin trước khi gửi đến nhà tuyển dụng." />
      <Card>
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <ReviewItem label="Công việc" value={job.title} />
          <ReviewItem label="Công ty" value={job.companyName} />
          <ReviewItem label="CV" value={cv?.fileName ?? "Chưa chọn"} />
          <ReviewItem label="Thông tin liên hệ" value="Nguyễn Văn An · an.nguyen@example.com · 0901 234 567" />
        </div>
      </Card>
      <Card>
        <p className="text-sm font-semibold text-slate-950">Thư giới thiệu</p>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{coverLetter || "Không có thư giới thiệu."}</p>
      </Card>
      <Card>
        <p className="text-sm font-semibold text-slate-950">Câu trả lời sàng lọc</p>
        <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
          <ReviewItem label="Số năm kinh nghiệm" value={`${answers.years} năm`} />
          <ReviewItem label="Ngày có thể bắt đầu" value={formatDate(answers.startDate)} />
          <ReviewItem label="Lương mong muốn" value={`${answers.salary} triệu đồng`} />
          <ReviewItem label="Onsite 3 ngày/tuần" value={answers.onsite} />
        </div>
      </Card>
      <Checkbox label="Tôi xác nhận thông tin ứng tuyển là chính xác." checked={confirmed} onChange={(event) => onConfirm(event.target.checked)} />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function SuccessStep({ applicationCode }: { applicationCode: string }) {
  return (
    <div className="space-y-4 text-center">
      <CheckCircle2 className="mx-auto text-emerald-600" size={48} />
      <div>
        <h3 className="text-lg font-semibold text-slate-950">Ứng tuyển thành công</h3>
        <p className="mt-2 text-sm text-slate-600">Đơn ứng tuyển đã được tạo và timeline “Đã gửi” đã được lưu.</p>
      </div>
      <div className="rounded-lg bg-emerald-50 p-4 text-emerald-700">
        <p className="text-sm">Mã ứng tuyển</p>
        <p className="mt-1 text-2xl font-bold">{applicationCode}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link to="/candidate/applications"><Button>Xem lịch sử ứng tuyển</Button></Link>
        <Link to="/candidate/jobs"><Button variant="secondary" icon={<Search size={16} />}>Tiếp tục tìm việc</Button></Link>
      </div>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

async function getSelectableCvs(open: boolean): Promise<{ items: Cv[] }> {
  if (!open) return { items: [] };
  const response = await httpClient.get<ApiResponse<BackendCvFileResponse[]>>("/students/me/cv");
  return { items: response.data.data.map(mapBackendCvFile) };
}

function mapBackendCvFile(cv: BackendCvFileResponse): Cv {
  return {
    id: String(cv.id),
    candidateId: "",
    fileName: cv.originalFileName ?? cv.storedFileName ?? `CV #${cv.id}`,
    uploadedAt: cv.uploadedAt ?? "",
    status: "analyzed",
    score: 0,
    isDefault: cv.active,
    isPublic: false,
    extractedSkills: [],
    missingFields: [],
    warnings: [],
  };
}

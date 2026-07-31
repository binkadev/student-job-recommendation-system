import { CheckCircle2, FileUp, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SectionHeader } from "../../../components/common/SectionHeader";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Checkbox } from "../../../components/ui/Checkbox";
import { Modal } from "../../../components/ui/Modal";
import { Stepper } from "../../../components/ui/Stepper";
import { Textarea } from "../../../components/ui/Textarea";
import { useAsyncData } from "../../../hooks/useAsyncData";
import { useToast } from "../../../hooks/useToast";
import { httpClient } from "../../../services/api/httpClient";
import type { Cv } from "../../../types/domain";
import { getApiErrorMessage } from "../../../utils/apiErrors";
import { useAppliedJobs } from "../../public/jobs/useAppliedJobs";

export interface ApplyFlowJob {
  id: string;
  title: string;
  companyName: string;
  salary?: string;
  location?: string;
  workMode?: string;
}

const steps = ["Chọn CV", "Thư giới thiệu", "Xem lại", "Thành công"];
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
  contentType?: string | null;
  fileSize?: number | null;
  active?: boolean;
  isActive?: boolean;
  uploadedAt?: string | null;
}

interface BackendCvAnalysisResponse {
  status?: string | null;
  skills?: string[] | null;
  warnings?: string[] | null;
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
  const [selectedCvId, setSelectedCvId] = useState<string | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applicationCode, setApplicationCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const cvs = useMemo(() => cvsQuery.data?.items ?? [], [cvsQuery.data?.items]);
  const selectedCv = cvs.find((cv) => cv.id === selectedCvId) ?? null;
  const dirty = step > 0 || Boolean(selectedCvId || coverLetter);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setSelectedCvId(null);
    setCoverLetter("");
    setConfirmed(false);
    setSubmitting(false);
    setApplicationCode("");
    setErrors({});
  }, [open, job?.id]);

  useEffect(() => {
    if (!open || selectedCvId !== null || cvs.length === 0) return;
    const defaultCv = cvs.find((cv) => cv.isDefault) ?? cvs[0];
    setSelectedCvId(defaultCv.id);
  }, [cvs, open, selectedCvId]);

  function requestClose() {
    if (submitting) return;
    if (dirty && step < 3 && !window.confirm("Bạn đang ứng tuyển dở. Đóng luồng này sẽ mất dữ liệu chưa gửi. Tiếp tục đóng?")) return;
    onClose();
  }

  function validateStep(currentStep = step) {
    const nextErrors: Record<string, string> = {};
    if (currentStep === 2 && !confirmed) nextErrors.confirmed = "Bạn cần xác nhận thông tin chính xác trước khi gửi.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function nextStep() {
    if (!validateStep()) return;
    setStep((current) => Math.min(2, current + 1));
  }

  async function submitApplication() {
    if (!job || !validateStep(2)) return;
    if (hasApplied(job.id)) {
      showToast({ type: "error", title: "Không thể ứng tuyển trùng", message: "Bạn đã ứng tuyển việc làm này trước đó." });
      return;
    }
    setSubmitting(true);
    try {
      const validCvId = selectedCvId && cvs.some((cv) => cv.id === selectedCvId) ? Number(selectedCvId) : null;
      const response = await httpClient.post<ApiResponse<BackendApplicationResponse>>(`/jobs/${job.id}/apply`, {
        cvFileId: validCvId,
        coverLetter: coverLetter.trim() || null,
      });
      const code = `APP-${response.data.data.id}`;
      applyToJob(job.id);
      setApplicationCode(code);
      setStep(3);
      showToast({ type: "success", title: "Ứng tuyển thành công", message: `Mã ứng tuyển của bạn là ${code}.` });
    } catch (error) {
      showToast({ type: "error", title: "Không thể gửi ứng tuyển", message: getApiErrorMessage(error, "Vui lòng kiểm tra CV đã chọn hoặc thử lại sau.") });
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
          <CvStep cvs={cvs} selectedCvId={selectedCvId ?? ""} error={errors.cv} onSelect={setSelectedCvId} />
        ) : null}
        {step === 1 ? (
          <CoverLetterStep coverLetter={coverLetter} onChange={setCoverLetter} onUseTemplate={() => setCoverLetter(coverTemplate)} />
        ) : null}
        {step === 2 && job ? (
          <ReviewStep job={job} cv={selectedCv} coverLetter={coverLetter} confirmed={confirmed} error={errors.confirmed} onConfirm={setConfirmed} />
        ) : null}
        {step === 3 ? <SuccessStep applicationCode={applicationCode} /> : null}
      </div>

      {step < 3 ? (
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={requestClose}>Đóng</Button>
          {step > 0 ? <Button variant="secondary" onClick={() => setStep((current) => current - 1)} disabled={submitting}>Quay lại</Button> : null}
          {step < 2 ? <Button onClick={nextStep}>Tiếp tục</Button> : null}
          {step === 2 ? <Button onClick={submitApplication} loading={submitting} disabled={submitting}>Gửi ứng tuyển</Button> : null}
        </div>
      ) : null}
    </Modal>
  );
}

function CvStep({ cvs, selectedCvId, error, onSelect }: { cvs: Cv[]; selectedCvId: string; error?: string; onSelect: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <SectionHeader title="Chọn CV" description="CV là tùy chọn khi ứng tuyển. Bạn có thể gửi hồ sơ không kèm CV hoặc chọn một CV đã tải lên." />
      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => onSelect("")}
          className={`rounded-lg border p-4 text-left transition ${selectedCvId === "" ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-200"}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-950">Không đính kèm CV</p>
              <p className="mt-1 text-sm text-slate-600">Chỉ gửi thư giới thiệu, không đính kèm CV.</p>
            </div>
            <StatusBadge label="Tùy chọn" />
          </div>
        </button>
        {cvs.map((cv) => {
          const status = cvStatusLabels[cv.status];
          return (
            <button
              key={cv.id}
              type="button"
              onClick={() => onSelect(cv.id)}
              className={`rounded-lg border p-4 text-left transition ${selectedCvId === cv.id ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-200"}`}
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

function ReviewStep({
  job,
  cv,
  coverLetter,
  confirmed,
  error,
  onConfirm,
}: {
  job: ApplyFlowJob;
  cv: Cv | null;
  coverLetter: string;
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
        </div>
      </Card>
      <Card>
        <p className="text-sm font-semibold text-slate-950">Thư giới thiệu</p>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{coverLetter || "Không có thư giới thiệu."}</p>
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
  const items = await Promise.all(response.data.data.map(async (cv) => {
    const analysis = await getCvAnalysis(cv.id);
    return mapBackendCvFile(cv, analysis);
  }));
  return { items };
}

async function getCvAnalysis(cvId: number): Promise<BackendCvAnalysisResponse | null> {
  try {
    const response = await httpClient.get<ApiResponse<BackendCvAnalysisResponse>>(`/students/me/cv/${cvId}/analysis`);
    return response.data.data;
  } catch {
    return null;
  }
}

function mapBackendCvFile(cv: BackendCvFileResponse, analysis: BackendCvAnalysisResponse | null): Cv {
  return {
    id: String(cv.id),
    candidateId: "",
    fileName: cv.originalFileName ?? `CV #${cv.id}`,
    uploadedAt: cv.uploadedAt ?? "",
    status: mapCvAnalysisStatus(analysis?.status),
    score: 0,
    isDefault: Boolean(cv.active ?? cv.isActive),
    isPublic: false,
    extractedSkills: analysis?.skills ?? [],
    missingFields: [],
    warnings: analysis?.warnings ?? [],
  };
}

function mapCvAnalysisStatus(status?: string | null): Cv["status"] {
  if (status === "READY") return "analyzed";
  if (status === "PROCESSING") return "analyzing";
  if (status === "FAILED") return "failed";
  return "uploaded";
}

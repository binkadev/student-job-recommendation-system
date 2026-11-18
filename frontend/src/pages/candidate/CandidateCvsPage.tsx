import {
  FileText,
  RefreshCw,
  UploadCloud,
  X,
  CheckCircle2,
  Sparkles,
  Zap,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { FileUploader } from "../../components/ui/FileUploader";
import { Modal } from "../../components/ui/Modal";
import { Switch } from "../../components/ui/Switch";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { httpClient } from "../../services/api/httpClient";
import { getApiErrorMessage } from "../../utils/apiErrors";
import { cvInUseMessage, isCvDeleteAvailable, isCvInUseError } from "./cvDeletion";

interface CandidateCvsPageProps {
  mode?: "list" | "upload" | "detail" | "analysis" | "edit-extracted" | "review";
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

interface CvFileResponse {
  id: number;
  fileName?: string | null;
  originalFileName: string;
  contentType?: string | null;
  fileSize?: number | null;
  extractedText?: string | null;
  processedText?: string | null;
  analysisStatus?: string | null;
  status?: string | null;
  active?: boolean;
  isActive?: boolean;
  deletable: boolean;
  deleteBlockedReason?: string | null;
  uploadedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface CvAnalysisResponse {
  cvId: number;
  extractedText?: string | null;
  processedText?: string | null;
  skills?: string[] | null;
  status?: string | null;
  analysisError?: string | null;
  languageCode?: string | null;
  languageConfidence?: number | string | null;
  processingVersion?: string | null;
  warnings?: string[] | null;
  analyzedAt?: string | null;
  uploadedAt?: string | null;
  updatedAt?: string | null;
}

const V3_PROCESSING_VERSION = "bilingual-nlp-v2-skills-v1";
const V3_SAME_LANGUAGE_CONFIDENCE_FLOOR = 0.65;

export function CandidateCvsPage({ mode = "list" }: CandidateCvsPageProps) {
  const { cvId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [active, setActive] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CvFileResponse | null>(null);
  const [activatingCvId, setActivatingCvId] = useState<number | null>(null);
  const activationPending = useRef(false);
  const cvsQuery = useAsyncData(() => getCandidateCvs(), [reloadKey]);
  const cvs = useMemo(() => cvsQuery.data ?? [], [cvsQuery.data]);
  const selectedCv = useMemo(() => {
    if (cvId) return cvs.find((cv) => String(cv.id) === cvId) ?? null;
    return cvs[0] ?? null;
  }, [cvId, cvs]);

  function handleFile(file: File) {
    const error = validateFile(file);
    setUploadError(error);
    if (error) {
      setSelectedFile(null);
      showToast({ type: "error", title: "File không hợp lệ", message: error });
      return;
    }
    setSelectedFile(file);
  }

  async function uploadCv() {
    if (!selectedFile) {
      setUploadError("Vui lòng chọn file CV trước khi tải lên.");
      return;
    }
    setUploading(true);
    try {
      const cv = await uploadCandidateCv(selectedFile, active);
      showToast({ type: "success", title: "Tải CV thành công", message: `${cv.originalFileName} đã được lưu.` });
      setReloadKey((current) => current + 1);
      navigate(`/candidate/cvs/${cv.id}`);
    } catch (error) {
      showToast({ type: "error", title: "Không thể tải CV", message: getApiErrorMessage(error) });
    } finally {
      setUploading(false);
    }
  }

  async function activateCv(cv: CvFileResponse) {
    if (activationPending.current) return;
    activationPending.current = true;
    setActivatingCvId(cv.id);
    try {
      const updatedCv = await activateCandidateCv(cv.id);
      showToast({ type: "success", title: "Đã đặt CV đang dùng", message: `${updatedCv.originalFileName} đang là CV được dùng.` });
      setReloadKey((current) => current + 1);
    } catch (error) {
      showToast({ type: "error", title: "Không thể đặt CV đang dùng", message: getApiErrorMessage(error) });
    } finally {
      activationPending.current = false;
      setActivatingCvId(null);
    }
  }

  async function deleteCv(cv: CvFileResponse) {
    try {
      await deleteCandidateCv(cv.id);
      setDeleteTarget(null);
      setReloadKey((current) => current + 1);
      showToast({ type: "success", title: "Đã xóa CV", message: cv.originalFileName });
    } catch (error) {
      const blocked = isCvInUseError(error);
      setDeleteTarget(null);
      setReloadKey((current) => current + 1);
      showToast({ type: "error", title: "Không thể xóa CV", message: blocked ? cvInUseMessage : getApiErrorMessage(error) });
    }
  }

  async function openCv(cv: CvFileResponse) {
    try {
      const response = await httpClient.get<Blob>(`/students/me/cv/${cv.id}/file`, { responseType: "blob" });
      const blobUrl = window.URL.createObjectURL(response.data);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
    } catch (error) {
      showToast({ type: "error", title: "Không thể mở CV", message: getApiErrorMessage(error) });
    }
  }

  if (cvsQuery.loading) {
    return (
      <PageContainer>
        <div className="rounded-2xl border border-[#E5E9F0] bg-white p-6 shadow-sm">
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-32 rounded-lg bg-[#E5E9F0]" />
            <div className="h-4 w-56 rounded-lg bg-[#E5E9F0]" />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (cvsQuery.error) {
    return (
      <PageContainer>
        <ErrorState message={cvsQuery.error} />
      </PageContainer>
    );
  }

  /* ── UPLOAD MODE ──────────────────────────────── */
  if (mode === "upload") {
    return (
      <PageContainer>
        <PageHeader title="Tải CV mới" description="Tải lên file PDF hoặc DOCX để phân tích và gợi ý việc làm phù hợp." />
        <div className="max-w-2xl">
          <div className="rounded-2xl border border-[#E5E9F0] bg-white p-6 shadow-sm">
            <SectionHeader title="Chọn file CV" description="Hỗ trợ PDF và DOCX. Sau khi tải lên, bạn có thể phân tích CV để nhận gợi ý việc làm." />
            <FileUploader label="Chọn file CV" accept=".pdf,.docx" onFileSelect={handleFile} disabled={uploading} />

            {selectedFile ? (
              <div className="mt-4 rounded-2xl border border-[#D6F2EC] bg-[#F0FAF8] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D6F2EC] text-[#134B43]">
                      <FileText size={18} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0C111C]">File đã chọn</p>
                      <p className="mt-0.5 break-words text-sm text-[#52637A]" title={selectedFile.name}>{selectedFile.name}</p>
                      <p className="mt-1 text-xs text-[#9BB0C9]">
                        {selectedFile.name.toLowerCase().endsWith(".docx") ? "DOCX" : "PDF"} · {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={uploading}
                    className="rounded-xl p-2 text-[#9BB0C9] hover:bg-white hover:text-red-600 disabled:opacity-50"
                    onClick={() => setSelectedFile(null)}
                    aria-label="Bỏ file đã chọn"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : null}

            {uploadError ? (
              <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {uploadError}
              </p>
            ) : null}

            <div className="mt-5">
              <Switch label="Đặt làm CV đang dùng" checked={active} onChange={setActive} disabled={uploading} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" loading={uploading} disabled={uploading || !selectedFile} onClick={() => void uploadCv()}>
                Tải lên
              </Button>
              <Link to="/candidate/cvs">
                <Button type="button" variant="secondary" disabled={uploading}>Hủy</Button>
              </Link>
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  if ((mode === "detail" || mode === "analysis" || mode === "edit-extracted" || mode === "review") && cvId && !selectedCv && !cvsQuery.loading) {
    return (
      <PageContainer>
        <ErrorState message="Không tìm thấy CV phù hợp." />
      </PageContainer>
    );
  }

  if (mode === "analysis" || mode === "edit-extracted" || mode === "review") {
    return <CvAnalysisView mode={mode} cvId={cvId ?? String(selectedCv?.id ?? "")} fallbackCv={selectedCv} onReload={() => setReloadKey((current) => current + 1)} />;
  }

  if (mode === "detail" && selectedCv) {
    return <CvDetailView cv={selectedCv} />;
  }

  /* ── LIST MODE ────────────────────────────────── */
  const activeCv = cvs.find((cv) => isActiveCv(cv));

  return (
    <PageContainer>
      {/* Page header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D6F2EC] bg-[#F0FAF8] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#134B43]">
            <FileText size={12} aria-hidden="true" />
            <span>Quản lý CV</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[#0C111C]">Hồ sơ CV của bạn</h1>
          <p className="mt-1 text-sm text-[#52637A]">Quản lý các CV dùng để ứng tuyển và cập nhật gợi ý việc làm.</p>
        </div>
        <Link to="/candidate/cvs/upload">
          <Button icon={<UploadCloud size={16} aria-hidden="true" />}>Tải CV mới</Button>
        </Link>
      </div>

      {/* Active CV hero */}
      {activeCv ? (
        <div className="mb-5 overflow-hidden rounded-2xl border border-[#D6F2EC] bg-gradient-to-br from-[#0C111C] to-[#1B2533] p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#237D70]/20 text-[#D5F36A]">
                <CheckCircle2 size={22} aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#78D2C3]">CV đang dùng</p>
                <p className="mt-0.5 font-semibold text-white">{activeCv.originalFileName || activeCv.fileName}</p>
                <p className="mt-1 text-xs text-[#9BB0C9]">
                  {getFileType(activeCv.contentType)} · {formatFileSize(activeCv.fileSize)} · Tải lên {formatDateTime(activeCv.uploadedAt)}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link to={`/candidate/cvs/${activeCv.id}/review`}>
                <Button size="sm" variant="secondary" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                  Đánh giá CV
                </Button>
              </Link>
              <Link to={`/candidate/cvs/${activeCv.id}/analysis`}>
                <Button size="sm" className="bg-[#D5F36A] text-[#0C111C] hover:bg-[#c8e85d]">
                  Phân tích
                </Button>
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* Stats row */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E9F0] bg-white px-3 py-1 text-sm font-medium text-[#52637A] shadow-sm">
          <FileText size={13} aria-hidden="true" />
          {cvs.length} CV
        </span>
        {cvs.some((cv) => isActiveCv(cv)) ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D6F2EC] bg-[#F0FAF8] px-3 py-1 text-sm font-medium text-[#134B43]">
            <CheckCircle2 size={13} aria-hidden="true" />
            Có CV đang dùng
          </span>
        ) : null}
      </div>

      {cvs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E5E9F0] bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0FAF8] text-[#237D70]">
            <FileText size={26} aria-hidden="true" />
          </div>
          <EmptyState message="Bạn chưa có CV nào." />
          <div className="mt-4">
            <Link to="/candidate/cvs/upload">
              <Button icon={<UploadCloud size={16} />}>Tải CV đầu tiên</Button>
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cvs.map((cv) => (
          <CvCard
            key={cv.id}
            cv={cv}
            activatingCvId={activatingCvId}
            onOpen={() => void openCv(cv)}
            onDelete={() => { if (isCvDeleteAvailable(cv)) setDeleteTarget(cv); }}
            onActivate={() => void activateCv(cv)}
          />
        ))}
      </div>
      <DeleteCvModal cv={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={(cv) => void deleteCv(cv)} />
    </PageContainer>
  );
}

/* ── CV Card ────────────────────────────────────────── */
function CvCard({
  cv,
  activatingCvId,
  onOpen,
  onDelete,
  onActivate,
}: {
  cv: CvFileResponse;
  activatingCvId: number | null;
  onOpen: () => void;
  onDelete: () => void;
  onActivate: () => void;
}) {
  const isActive = isActiveCv(cv);
  const hasAnalysis = hasCvAnalysis(cv);

  return (
    <div className={`group relative flex flex-col rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${isActive ? "border-[#D6F2EC] ring-1 ring-[#AEE6DC]/60" : "border-[#E5E9F0]"}`}>
      {/* Card header */}
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isActive ? "bg-[#D6F2EC] text-[#134B43]" : "bg-[#F7F8F6] text-[#9BB0C9]"}`}>
            <FileText size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="break-words font-semibold text-[#0C111C] leading-snug" title={cv.originalFileName || cv.fileName || ""}>
              {cv.originalFileName || cv.fileName || "CV chưa cập nhật tên"}
            </h2>
            <p className="mt-0.5 text-xs text-[#9BB0C9]">{getFileType(cv.contentType)} · {formatFileSize(cv.fileSize)}</p>
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg p-1.5 text-[#C8D5E5] hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!isCvDeleteAvailable(cv)}
          title={cv.deletable ? "Xóa CV" : cvInUseMessage}
          onClick={onDelete}
          aria-label="Xóa CV"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {/* Meta */}
      <div className="px-5 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {isActive ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#D6F2EC] bg-[#F0FAF8] px-2.5 py-0.5 text-xs font-semibold text-[#134B43]">
              <CheckCircle2 size={11} aria-hidden="true" /> Đang dùng
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#E5E9F0] bg-[#F7F8F6] px-2.5 py-0.5 text-xs font-medium text-[#9BB0C9]">
              Chưa dùng
            </span>
          )}
          {hasAnalysis ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#D6F2EC] bg-[#F0FAF8] px-2.5 py-0.5 text-xs font-medium text-[#237D70]">
              <Zap size={10} aria-hidden="true" /> Đã phân tích
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-[#9BB0C9]">Tải lên: {formatDateTime(cv.uploadedAt)}</p>
      </div>

      {/* Actions */}
      <div className="mt-auto flex flex-wrap gap-2 border-t border-[#F0F4F8] px-5 py-3">
        <Link to={`/candidate/cvs/${cv.id}`}>
          <Button variant="secondary" size="sm">Xem</Button>
        </Link>
        <Button variant="secondary" size="sm" onClick={onOpen}>Mở file</Button>
        <Link to={`/candidate/cvs/${cv.id}/analysis`}>
          <Button variant="secondary" size="sm">{hasAnalysis ? "Phân tích lại" : "Phân tích"}</Button>
        </Link>
        <Link to={`/candidate/cvs/${cv.id}/review`}>
          <Button variant="secondary" size="sm">Đánh giá</Button>
        </Link>
        {!isActive ? (
          <Button
            variant="secondary"
            size="sm"
            loading={activatingCvId === cv.id}
            disabled={activatingCvId !== null}
            onClick={onActivate}
          >
            Đặt làm CV đang dùng
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/* ── CV Detail View ─────────────────────────────────── */
function CvDetailView({ cv }: { cv: CvFileResponse }) {
  const { showToast } = useToast();
  const navigate = useNavigate();

  async function setActive() {
    try {
      await activateCandidateCv(cv.id);
      showToast({ type: "success", title: "Đã đặt CV đang dùng", message: cv.originalFileName });
      navigate("/candidate/cvs");
    } catch (error) {
      showToast({ type: "error", title: "Không thể đặt CV đang dùng", message: getApiErrorMessage(error) });
    }
  }

  async function openFile() {
    try {
      await openCandidateCvFile(cv.id);
    } catch (error) {
      showToast({ type: "error", title: "Không thể mở CV", message: getApiErrorMessage(error) });
    }
  }

  return (
    <PageContainer>
      <PageHeader title="Chi tiết CV" description="Thông tin file CV và trạng thái sử dụng hiện tại." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <div className="rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
            <SectionHeader title="Thông tin file" />
            <div className="grid gap-3 text-sm text-[#52637A] md:grid-cols-2">
              <SummaryItem label="ID" value={String(cv.id)} />
              <SummaryItem label="Tên file gốc" value={cv.originalFileName} />
              <SummaryItem label="Loại nội dung" value={cv.contentType || "Chưa cập nhật"} />
              <SummaryItem label="Dung lượng" value={formatFileSize(cv.fileSize)} />
              <SummaryItem label="Ngày tải lên" value={formatDateTime(cv.uploadedAt)} />
              <SummaryItem label="CV đang dùng" value={isActiveCv(cv) ? "Có" : "Không"} />
            </div>
          </div>
        </div>
        <section aria-label="Thao tác CV" className="min-w-0 space-y-5">
          <div className="rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
            <SectionHeader title="Thao tác" />
            <div className="grid gap-2">
              <Link to="/candidate/cvs"><Button variant="secondary" className="w-full">Quay lại danh sách</Button></Link>
              <Link to="/candidate/cvs/upload"><Button className="w-full">Tải CV mới</Button></Link>
              <Link to={`/candidate/cvs/${cv.id}/analysis`}><Button variant="secondary" className="w-full">Kết quả phân tích CV</Button></Link>
              <Link to={`/candidate/cvs/${cv.id}/review`}><Button variant="secondary" className="w-full">Đánh giá CV</Button></Link>
              <Button variant="secondary" className="w-full" onClick={() => void openFile()}>Mở file CV</Button>
              {!isActiveCv(cv) ? <Button variant="secondary" className="w-full" onClick={() => void setActive()}>Đặt làm CV đang dùng</Button> : null}
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}

/* ── Delete Modal ───────────────────────────────────── */
function DeleteCvModal({ cv, onClose, onConfirm }: { cv: CvFileResponse | null; onClose: () => void; onConfirm: (cv: CvFileResponse) => void }) {
  return (
    <Modal open={Boolean(cv)} title="Xóa CV" onClose={onClose}>
      <div className="space-y-4">
        <p className="break-words text-sm text-[#52637A] [overflow-wrap:anywhere]">
          Bạn có muốn xóa CV <strong className="text-[#0C111C]">{cv?.originalFileName}</strong> không?
        </p>
        {cv && isActiveCv(cv) ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">Đây là CV đang dùng. Bạn có chắc muốn xóa?</p>
        ) : null}
        <p className="text-sm text-[#9BB0C9]">Chỉ CV chưa từng dùng trong ứng tuyển, gợi ý việc làm hoặc xếp hạng ứng viên mới có thể xóa.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant="danger" onClick={() => cv && onConfirm(cv)}>Có, xóa CV</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── CV Analysis View ───────────────────────────────── */
function CvAnalysisView({
  mode,
  cvId,
  fallbackCv,
  onReload,
}: {
  mode: Exclude<NonNullable<CandidateCvsPageProps["mode"]>, "list" | "upload" | "detail">;
  cvId: string;
  fallbackCv?: CvFileResponse | null;
  onReload: () => void;
}) {
  const { showToast } = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [reanalyzing, setReanalyzing] = useState(false);
  const cvQuery = useAsyncData(() => (cvId ? getCandidateCvDetail(Number(cvId)) : Promise.resolve(fallbackCv)), [cvId, reloadKey]);
  const analysisQuery = useAsyncData(() => (cvId ? getCandidateCvAnalysis(Number(cvId)) : Promise.resolve(null)), [cvId, reloadKey]);
  const cv = cvQuery.data ?? fallbackCv;
  const title = mode === "analysis" ? "Phân tích CV" : mode === "edit-extracted" ? "Chỉnh dữ liệu trích xuất" : "Đánh giá CV";
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (mode !== "analysis" || cvQuery.loading || analysisQuery.loading || !cv || !containerRef.current) return;
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ".nova-cv-reveal",
          { autoAlpha: 0, y: 14 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            ease: "power3.out",
            stagger: 0.07,
            clearProps: "all",
          },
        );
      });

      return () => mm.revert();
    },
    {
      scope: containerRef.current ? containerRef : undefined,
      dependencies: [mode, cvQuery.loading, analysisQuery.loading, Boolean(cv)],
    },
  );

  async function reanalyzeCv() {
    if (!cv) return;
    setReanalyzing(true);
    try {
      await reanalyzeCandidateCv(cv.id);
      showToast({ type: "success", title: "Đã gửi yêu cầu phân tích lại", message: cv.originalFileName });
      setReloadKey((current) => current + 1);
      onReload();
    } catch (error) {
      showToast({ type: "error", title: "Không thể phân tích lại CV", message: getApiErrorMessage(error) });
    } finally {
      setReanalyzing(false);
    }
  }

  if (cvQuery.loading || analysisQuery.loading) {
    return (
      <PageContainer>
        <div className="rounded-2xl border border-[#E5E9F0] bg-white p-6 shadow-sm">
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-40 rounded-lg bg-[#E5E9F0]" />
            <div className="h-4 w-64 rounded-lg bg-[#E5E9F0]" />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (cvQuery.error) return <PageContainer><ErrorState message={cvQuery.error} /></PageContainer>;
  if (analysisQuery.error) return <PageContainer><ErrorState message={analysisQuery.error} /></PageContainer>;

  if (!cv) {
    return (
      <PageContainer>
        <PageHeader title={title} description="Chưa chọn CV để phân tích." />
        <Card>
          <EmptyState message="Không tìm thấy CV cần xem." />
          <div className="mt-4"><Link to="/candidate/cvs"><Button variant="secondary">Quay lại danh sách CV</Button></Link></div>
        </Card>
      </PageContainer>
    );
  }

  if (mode === "edit-extracted") {
    return (
      <PageContainer>
        <PageHeader title={title} description="Xem lại dữ liệu được trích xuất từ CV." />
        <Card>
          <EmptyState message="Chức năng chỉnh extracted data chưa được hỗ trợ trong MVP. Bạn có thể xem phân tích CV hoặc bấm phân tích lại để AI cập nhật dữ liệu." />
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={`/candidate/cvs/${cv.id}/analysis`}><Button>Xem phân tích CV</Button></Link>
            <Link to="/candidate/cvs"><Button variant="secondary">Quay lại danh sách CV</Button></Link>
          </div>
        </Card>
      </PageContainer>
    );
  }

  const analysis = analysisQuery.data;
  const analysisReady = analysis?.status === "READY";
  const analysisFailed = analysis?.status === "FAILED";
  const analyzeButtonLabel = analysis?.status ? "Phân tích lại" : "Phân tích";
  const warnings = analysis?.warnings ?? [];

  if (mode === "review") {
    return (
      <CvReviewView
        cv={cv}
        analysis={analysis}
        reanalyzing={reanalyzing}
        analyzeButtonLabel={analyzeButtonLabel}
        onReanalyze={() => void reanalyzeCv()}
      />
    );
  }

  /* ── Analysis mode ── */
  return (
    <PageContainer>
      <div ref={containerRef}>
        {/* Header strip */}
        <div className="nova-cv-reveal mb-5 overflow-hidden rounded-2xl border border-[#E5E9F0] bg-[#0C111C] p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#237D70]/30 bg-[#237D70]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#78D2C3]">
                <Sparkles size={12} aria-hidden="true" />
                <span>Phân tích CV</span>
              </div>
              <h1 className="mt-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                {cv.originalFileName || cv.fileName}
              </h1>
              <p className="mt-1 text-sm text-[#9BB0C9]">
                Trạng thái: <span className={analysisReady ? "text-[#D5F36A]" : analysisFailed ? "text-red-400" : "text-[#9BB0C9]"}>{analysis?.status ?? "Chưa phân tích"}</span>
                {" "}· {getFileType(cv.contentType)} · {formatFileSize(cv.fileSize)}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                loading={reanalyzing}
                disabled={reanalyzing}
                onClick={() => void reanalyzeCv()}
                icon={<RefreshCw size={15} aria-hidden="true" />}
              >
                {analyzeButtonLabel}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_288px]">
          <div className="min-w-0 space-y-5">
            {/* Thông tin CV */}
            <section className="nova-cv-reveal rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
              <SectionHeader title="Thông tin CV" />
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <SummaryItem label="ID" value={String(cv.id)} />
                <SummaryItem label="Tên file" value={cv.originalFileName || cv.fileName || "Chưa cập nhật"} />
                <SummaryItem label="Loại nội dung" value={cv.contentType || "Chưa cập nhật"} />
                <SummaryItem label="Dung lượng" value={formatFileSize(cv.fileSize)} />
                <SummaryItem label="CV đang dùng" value={isActiveCv(cv) ? "Có" : "Không"} />
                <SummaryItem label="Trạng thái phân tích" value={analysis?.status ?? "Chưa cập nhật"} />
                <SummaryItem label="Ngôn ngữ phát hiện" value={formatLanguageCode(analysis?.languageCode)} />
                <SummaryItem label="Độ tin cậy ngôn ngữ" value={formatLanguageConfidence(analysis?.languageConfidence)} />
                <SummaryItem label="Phiên bản xử lý" value={analysis?.processingVersion || "Chưa cập nhật"} />
                <SummaryItem label="Thời điểm phân tích" value={formatDateTime(analysis?.analyzedAt)} />
                <SummaryItem label="Ngày tải lên" value={formatDateTime(analysis?.uploadedAt ?? cv.uploadedAt)} />
                <SummaryItem label="Cập nhật" value={formatDateTime(analysis?.updatedAt ?? cv.updatedAt)} />
              </div>
            </section>

            {analysisFailed ? (
              <section className="nova-cv-reveal rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
                <SectionHeader title="Phân tích thất bại" />
                <EmptyState message={analysis?.analysisError ?? "CV chưa phân tích thành công. Vui lòng bấm phân tích lại."} />
                <div className="mt-4">
                  <Button loading={reanalyzing} disabled={reanalyzing} onClick={() => void reanalyzeCv()} icon={<RefreshCw size={15} />}>{analyzeButtonLabel}</Button>
                </div>
              </section>
            ) : null}

            {!analysisReady && !analysisFailed ? (
              <section className="nova-cv-reveal rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
                <SectionHeader title="Dữ liệu phân tích" />
                <EmptyState message="CV chưa ở trạng thái READY nên chưa hiển thị nội dung phân tích." />
              </section>
            ) : null}

            {analysisReady ? (
              <>
                {/* Cảnh báo */}
                <section className="nova-cv-reveal rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
                  <SectionHeader
                    title="Cảnh báo phân tích"
                    description={warnings.length ? `${warnings.length} cảnh báo được ghi nhận từ bộ phân tích V2.` : "Trạng thái cảnh báo từ quá trình trích xuất và chuẩn hóa."}
                  />
                  {warnings.length ? (
                    <ul className="list-disc space-y-2 pl-5 text-sm text-amber-800">
                      {warnings.map((warning, index) => (
                        <li key={`${index}-${warning}`} className="break-words">{warning}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-[#52637A]">Không có cảnh báo nào từ quá trình phân tích.</p>
                  )}
                </section>

                {/* Văn bản đã xử lý */}
                <section className="nova-cv-reveal rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
                  <SectionHeader title="Văn bản đã xử lý" />
                  {analysis?.processedText ? (
                    <pre role="region" aria-label="Nội dung CV đã xử lý, cuộn để đọc" tabIndex={0} className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-xl bg-[#F7F8F6] p-4 text-sm text-[#52637A]">
                      {analysis.processedText}
                    </pre>
                  ) : (
                    <EmptyState message="Chưa có văn bản đã xử lý cho CV này." />
                  )}
                </section>

                {/* Kỹ năng trích xuất */}
                <section className="nova-cv-reveal rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
                  <SectionHeader title="Kỹ năng trích xuất" />
                  {analysis?.skills?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {analysis.skills.map((skill) => (
                        <span key={skill} className="inline-flex items-center rounded-full border border-[#D6F2EC] bg-[#F0FAF8] px-3 py-1 text-xs font-semibold text-[#134B43]">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <EmptyState message="Chưa có kỹ năng trích xuất cho CV này." />
                  )}
                </section>

                {/* Dữ liệu trích xuất */}
                <section className="nova-cv-reveal rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
                  <SectionHeader title="Dữ liệu trích xuất" />
                  {analysis?.extractedText ? (
                    <pre role="region" aria-label="Nội dung CV trích xuất, cuộn để đọc" tabIndex={0} className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-xl bg-[#F7F8F6] p-4 text-sm text-[#52637A]">
                      {analysis.extractedText}
                    </pre>
                  ) : (
                    <EmptyState message="Chưa có extractedText cho CV này." />
                  )}
                </section>
              </>
            ) : null}
          </div>

          {/* Right sidebar */}
          <section aria-label="Trạng thái và thao tác CV" className="min-w-0 space-y-5">
            <div className="rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
              <SectionHeader title="Trạng thái" />
              <div className="flex flex-wrap gap-2">
                {isActiveCv(cv) ? <StatusBadge label="Đang dùng" tone="success" /> : <StatusBadge label="Chưa dùng" />}
                <StatusBadge label={analysis?.status ?? "Chưa cập nhật"} tone={analysisReady ? "success" : analysisFailed ? "danger" : "warning"} />
                <StatusBadge label={analysisReady ? "Có dữ liệu phân tích" : "Chưa hiển thị dữ liệu"} tone={analysisReady ? "success" : "warning"} />
              </div>
            </div>
            <div className="rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
              <SectionHeader title="Thao tác" />
              <div className="grid gap-2">
                <Button className="w-full" loading={reanalyzing} disabled={reanalyzing} onClick={() => void reanalyzeCv()} icon={<RefreshCw size={15} />}>{analyzeButtonLabel}</Button>
                <Link to={`/candidate/cvs/${cv.id}/review`}><Button variant="secondary" className="w-full">Đánh giá CV</Button></Link>
                <Link to={`/candidate/cvs/${cv.id}`}><Button variant="secondary" className="w-full">Chi tiết CV</Button></Link>
                <Link to="/candidate/cvs"><Button variant="secondary" className="w-full">Quay lại danh sách</Button></Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </PageContainer>
  );
}

/* ── CV Review View ─────────────────────────────────── */
function CvReviewView({
  cv,
  analysis,
  reanalyzing,
  analyzeButtonLabel,
  onReanalyze,
}: {
  cv: CvFileResponse;
  analysis: CvAnalysisResponse | null;
  reanalyzing: boolean;
  analyzeButtonLabel: string;
  onReanalyze: () => void;
}) {
  const analysisReady = analysis?.status === "READY";
  const analysisFailed = analysis?.status === "FAILED";
  const skills = analysis?.skills ?? [];
  const warnings = analysis?.warnings ?? [];
  const extractedText = analysis?.extractedText?.trim() ?? "";
  const processedText = analysis?.processedText?.trim() ?? "";
  const extractedCharCount = extractedText.length;
  const extractedLineCount = extractedText ? extractedText.split(/\r?\n/).filter((line) => line.trim().length > 0).length : 0;
  const processedTokenCount = processedText ? processedText.split(/\s+/).filter(Boolean).length : 0;
  const confidenceNumber = toConfidenceNumber(analysis?.languageConfidence);
  const normalizedLang = (analysis?.languageCode ?? "").trim().toLowerCase();
  const isBilingualSupportedLang = normalizedLang === "vi" || normalizedLang === "en";
  const meetsSameLanguageConfidence =
    analysisReady && isBilingualSupportedLang && confidenceNumber !== null && confidenceNumber >= V3_SAME_LANGUAGE_CONFIDENCE_FLOOR;
  const matchesV3ProcessingVersion = analysis?.processingVersion === V3_PROCESSING_VERSION;
  const isV3SnapshotEligible =
    analysisReady &&
    Boolean(processedText) &&
    Boolean(normalizedLang) &&
    confidenceNumber !== null &&
    confidenceNumber >= 0 &&
    confidenceNumber <= 1 &&
    matchesV3ProcessingVersion;

  const deterministicObservations = buildDeterministicReviewObservations({
    cv,
    analysisReady,
    analysisFailed,
    analysisError: analysis?.analysisError ?? null,
    matchesV3ProcessingVersion,
    processingVersion: analysis?.processingVersion ?? null,
    meetsSameLanguageConfidence,
    languageCode: analysis?.languageCode ?? null,
    languageConfidence: analysis?.languageConfidence ?? null,
    skillsCount: skills.length,
    processedTokenCount,
    warnings,
  });

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-5 overflow-hidden rounded-2xl border border-[#E5E9F0] bg-[#0C111C] p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D5F36A]/30 bg-[#D5F36A]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#D5F36A]">
              <ShieldCheck size={12} aria-hidden="true" />
              <span>Đánh giá CV</span>
            </div>
            <h1 className="mt-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
              Tổng hợp sẵn sàng V3
            </h1>
            <p className="mt-1 text-sm text-[#9BB0C9]">
              {cv.originalFileName || cv.fileName} ·{" "}
              <span className={isV3SnapshotEligible ? "text-[#D5F36A]" : "text-amber-400"}>
                {isV3SnapshotEligible ? "Đủ điều kiện gợi ý V3" : "Cần phân tích V2"}
              </span>
            </p>
          </div>
          <Button
            loading={reanalyzing}
            disabled={reanalyzing}
            onClick={onReanalyze}
            icon={<RefreshCw size={15} aria-hidden="true" />}
          >
            {analyzeButtonLabel}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_288px]">
        <div className="min-w-0 space-y-5">
          {/* Trạng thái sẵn sàng cho gợi ý việc làm V3 */}
          <section className="rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
            <SectionHeader
              title="Trạng thái sẵn sàng cho gợi ý việc làm V3"
              description="Kiểm tra xác định dựa trên bản chụp phân tích đã lưu (không sử dụng điểm AI giả định)."
            />
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <SummaryItem label="File CV" value={cv.originalFileName || cv.fileName || "Chưa cập nhật"} />
              <SummaryItem label="CV đang dùng" value={isActiveCv(cv) ? "Đang dùng làm CV mặc định" : "Chưa đặt làm CV đang dùng"} />
              <SummaryItem label="Trạng thái bản chụp" value={analysis?.status ?? "NOT_READY"} />
              <SummaryItem label="Đủ điều kiện chạy gợi ý V3" value={isV3SnapshotEligible ? "Đủ điều kiện (Sẵn sàng)" : "Chưa đủ điều kiện (Cần phân tích V2)"} />
              <SummaryItem
                label="Phiên bản tiền xử lý"
                value={
                  analysis?.processingVersion
                    ? `${analysis.processingVersion} (${matchesV3ProcessingVersion ? "Khớp chuẩn V3" : "Khác chuẩn V3 hiện hành"})`
                    : "Chưa cập nhật"
                }
              />
              <SummaryItem label="Thời điểm phân tích gần nhất" value={formatDateTime(analysis?.analyzedAt)} />
            </div>
          </section>

          {/* Định tuyến chiến lược */}
          <section className="rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
            <SectionHeader
              title="Định tuyến chiến lược đối sánh V3"
              description="Chế độ đối sánh được xác định minh bạch từ ngôn ngữ CV và độ tin cậy đã lưu (ngưỡng chuẩn V3: ≥ 65.0% cho vi/en)."
            />
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <SummaryItem label="Ngôn ngữ phát hiện" value={formatLanguageCode(analysis?.languageCode)} />
              <SummaryItem label="Độ tin cậy ngôn ngữ" value={formatLanguageConfidence(analysis?.languageConfidence)} />
              <SummaryItem
                label="Với việc làm cùng ngôn ngữ"
                value={
                  !analysisReady
                    ? "Chưa xác định (CV chưa READY)"
                    : meetsSameLanguageConfidence
                      ? "PRIMARY — SAME_LANGUAGE_HYBRID (65% văn bản TF-IDF + 35% kỹ năng)"
                      : "FALLBACK — CROSS_LANGUAGE_SKILL_BASED (100% theo kỹ năng chuẩn hóa)"
                }
              />
              <SummaryItem
                label="Với việc làm khác ngôn ngữ"
                value={!analysisReady ? "Chưa xác định (CV chưa READY)" : "FALLBACK — CROSS_LANGUAGE_SKILL_BASED (100% theo kỹ năng chuẩn hóa)"}
              />
            </div>
          </section>

          {/* Thống kê */}
          <section className="rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
            <SectionHeader title="Thống kê dữ liệu trích xuất" description="Số liệu từ văn bản và kỹ năng chuẩn hóa đã lưu." />
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <SummaryItem label="Số kỹ năng chuẩn hóa" value={`${skills.length} kỹ năng`} />
              <SummaryItem label="Số cảnh báo phân tích" value={`${warnings.length} cảnh báo`} />
              <SummaryItem label="Độ dài văn bản trích xuất (raw)" value={`${extractedCharCount} ký tự (${extractedLineCount} dòng)`} />
              <SummaryItem label="Số lượng token chuẩn hóa (processed)" value={`${processedTokenCount} token`} />
            </div>
            {skills.length ? (
              <div className="mt-4 border-t border-[#F0F4F8] pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#9BB0C9]">Danh sách kỹ năng chuẩn hóa dùng để đối sánh</p>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <span key={skill} className="inline-flex items-center rounded-full border border-[#D6F2EC] bg-[#F0FAF8] px-2.5 py-0.5 text-xs font-semibold text-[#134B43]">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {warnings.length ? (
              <div className="mt-4 border-t border-[#F0F4F8] pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-700">Cảnh báo ghi nhận</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
                  {warnings.map((warning, index) => (
                    <li key={`${index}-${warning}`} className="break-words">{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          {/* Nhận xét */}
          <section className="rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
            <SectionHeader
              title="Nhận xét & Hướng dẫn cải thiện"
              description="Gợi ý dựa trên dữ liệu đã lưu của CV và quy tắc đối sánh thực tế của hệ thống."
            />
            <ul className="space-y-3">
              {deterministicObservations.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-6 text-[#52637A]">
                  <ChevronRight size={15} className="mt-0.5 shrink-0 text-[#237D70]" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Right rail */}
        <section aria-label="Trạng thái và thao tác đánh giá CV" className="min-w-0 space-y-5">
          <div className="rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
            <SectionHeader title="Trạng thái" />
            <div className="flex flex-wrap gap-2">
              {isActiveCv(cv) ? <StatusBadge label="Đang dùng" tone="success" /> : <StatusBadge label="Chưa dùng" />}
              <StatusBadge label={analysis?.status ?? "Chưa cập nhật"} tone={analysisReady ? "success" : analysisFailed ? "danger" : "warning"} />
              <StatusBadge label={isV3SnapshotEligible ? "Sẵn sàng gợi ý V3" : "Cần phân tích V2"} tone={isV3SnapshotEligible ? "success" : "warning"} />
            </div>
          </div>
          <div className="rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
            <SectionHeader title="Thao tác" />
            <div className="grid gap-2">
              <Button className="w-full" loading={reanalyzing} disabled={reanalyzing} onClick={onReanalyze} icon={<RefreshCw size={15} />}>{analyzeButtonLabel}</Button>
              <Link to="/candidate/jobs/recommended"><Button variant="secondary" className="w-full">Xem việc làm gợi ý</Button></Link>
              <Link to={`/candidate/cvs/${cv.id}/analysis`}><Button variant="secondary" className="w-full">Xem phân tích kỹ thuật</Button></Link>
              <Link to={`/candidate/cvs/${cv.id}`}><Button variant="secondary" className="w-full">Chi tiết CV</Button></Link>
              <Link to="/candidate/cvs"><Button variant="secondary" className="w-full">Quay lại danh sách</Button></Link>
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}

/* ── Utility components ─────────────────────────────── */
function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#F7F8F6] p-3">
      <p className="text-xs font-medium text-[#9BB0C9]">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-[#0C111C] [overflow-wrap:anywhere]">{value}</p>
    </div>
  );
}

/* ── API helpers ────────────────────────────────────── */
async function getCandidateCvs() {
  const response = await httpClient.get<ApiResponse<CvFileResponse[]>>("/students/me/cv");
  return response.data.data;
}

async function getCandidateCvDetail(cvId: number) {
  const response = await httpClient.get<ApiResponse<CvFileResponse>>(`/students/me/cv/${cvId}`);
  return response.data.data;
}

async function getCandidateCvAnalysis(cvId: number) {
  const response = await httpClient.get<ApiResponse<CvAnalysisResponse>>(`/students/me/cv/${cvId}/analysis`);
  return response.data.data;
}

async function uploadCandidateCv(file: File, active: boolean) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await httpClient.post<ApiResponse<CvFileResponse>>("/students/me/cv", formData, {
    params: { active },
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.data;
}

async function activateCandidateCv(cvId: number) {
  const response = await httpClient.patch<ApiResponse<CvFileResponse>>(`/students/me/cv/${cvId}/active`);
  return response.data.data;
}

async function reanalyzeCandidateCv(cvId: number) {
  const response = await httpClient.post<ApiResponse<CvAnalysisResponse>>(`/students/me/cv/${cvId}/reanalyze`);
  return response.data.data;
}

async function deleteCandidateCv(cvId: number) {
  await httpClient.delete<ApiResponse<null>>(`/students/me/cv/${cvId}`);
}

async function openCandidateCvFile(cvId: number) {
  const response = await httpClient.get<Blob>(`/students/me/cv/${cvId}/file`, { responseType: "blob" });
  const blobUrl = window.URL.createObjectURL(response.data);
  window.open(blobUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
}

/* ── Pure helpers ───────────────────────────────────── */
function isActiveCv(cv: CvFileResponse) {
  return Boolean(cv.active ?? cv.isActive);
}

function hasCvAnalysis(cv: CvFileResponse) {
  const status = String(cv.analysisStatus ?? cv.status ?? "").toUpperCase();
  return Boolean(cv.extractedText?.trim() || cv.processedText?.trim() || ["READY", "FAILED", "PROCESSING"].includes(status));
}

function validateFile(file: File) {
  const isValidExtension = [".pdf", ".docx"].some((extension) => file.name.toLowerCase().endsWith(extension));
  if (!isValidExtension) return "Chỉ chấp nhận file PDF hoặc DOCX.";
  return "";
}

function getFileType(contentType?: string | null) {
  if (!contentType) return "File";
  if (contentType.includes("pdf")) return "PDF";
  if (contentType.includes("wordprocessingml")) return "DOCX";
  return contentType || "File";
}

function formatFileSize(size?: number | null) {
  if (size == null) return "Chưa cập nhật";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toConfidenceNumber(value?: number | string | null): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatLanguageCode(languageCode?: string | null) {
  const normalized = (languageCode ?? "").trim().toLowerCase();
  if (!normalized) return "Chưa cập nhật";
  if (normalized === "vi") return "Tiếng Việt (vi)";
  if (normalized === "en") return "Tiếng Anh (en)";
  if (normalized === "mixed") return "Đa ngôn ngữ / Hỗn hợp (mixed)";
  if (normalized === "unknown") return "Chưa xác định (unknown)";
  return normalized;
}

function formatLanguageConfidence(confidence?: number | string | null) {
  const numeric = toConfidenceNumber(confidence);
  if (numeric === null) return "Chưa cập nhật";
  const percentage = (numeric * 100).toFixed(1);
  return `${percentage}% (${numeric.toFixed(4)})`;
}

function buildDeterministicReviewObservations(params: {
  cv: CvFileResponse;
  analysisReady: boolean;
  analysisFailed: boolean;
  analysisError: string | null;
  matchesV3ProcessingVersion: boolean;
  processingVersion: string | null;
  meetsSameLanguageConfidence: boolean;
  languageCode: string | null;
  languageConfidence: number | string | null;
  skillsCount: number;
  processedTokenCount: number;
  warnings: string[];
}): string[] {
  const items: string[] = [];

  if (params.analysisFailed) {
    items.push(
      params.analysisError
        ? `Quá trình phân tích gần nhất không thành công (${params.analysisError}). Hãy bấm Phân tích lại để tạo bản chụp hợp lệ.`
        : "Quá trình phân tích gần nhất không thành công. Hãy bấm Phân tích lại để cập nhật bản chụp CV.",
    );
    return items;
  }

  if (!params.analysisReady) {
    items.push("CV chưa ở trạng thái READY nên chưa thể dùng để tạo gợi ý việc làm V3. Vui lòng bấm Phân tích hoặc Phân tích lại.");
    return items;
  }

  if (params.matchesV3ProcessingVersion) {
    items.push(`Bản chụp CV đã được xử lý bằng phiên bản chuẩn ${V3_PROCESSING_VERSION} (${params.processedTokenCount} token chuẩn hóa) và sẵn sàng cho gợi ý việc làm V3 mà không cần tiền xử lý lại.`);
  } else {
    items.push(`Phiên bản tiền xử lý hiện tại (${params.processingVersion || "chưa có"}) khác với chuẩn ${V3_PROCESSING_VERSION}. Bạn nên bấm Phân tích lại để đồng bộ bản chụp V2/V3.`);
  }

  if (params.meetsSameLanguageConfidence) {
    items.push(
      `Ngôn ngữ CV (${formatLanguageCode(params.languageCode)}, độ tin cậy ${formatLanguageConfidence(params.languageConfidence)}) đạt ngưỡng ≥ 65.0%, đủ điều kiện đối sánh kết hợp văn bản TF-IDF (65%) và kỹ năng (35%) với các tin tuyển dụng cùng ngôn ngữ.`,
    );
  } else {
    items.push(
      `Ngôn ngữ CV (${formatLanguageCode(params.languageCode)}, độ tin cậy ${formatLanguageConfidence(params.languageConfidence)}) sẽ được định tuyến sang chế độ FALLBACK (CROSS_LANGUAGE_SKILL_BASED), đối sánh hoàn toàn dựa trên danh sách kỹ năng chuẩn hóa.`,
    );
  }

  if (params.skillsCount === 0) {
    items.push("Chưa ghi nhận được kỹ năng chuẩn hóa nào từ văn bản CV. Vì tỷ lệ khớp kỹ năng quyết định 35% điểm ở chế độ cùng ngôn ngữ (PRIMARY) và 100% ở chế độ khác ngôn ngữ (FALLBACK), bạn nên bổ sung rõ tên các kỹ năng/công nghệ chuyên môn trong file CV và phân tích lại.");
  } else {
    items.push(`Đã trích xuất ${params.skillsCount} kỹ năng chuẩn hóa từ CV để phục vụ đối sánh trực tiếp với yêu cầu kỹ năng của tin tuyển dụng.`);
  }

  if (params.warnings.length > 0) {
    items.push(`Bộ phân tích ghi nhận ${params.warnings.length} cảnh báo từ tài liệu gốc. Vui lòng kiểm tra mục cảnh báo phía trên để đảm bảo nội dung CV không bị khuyết thiếu do định dạng file.`);
  } else {
    items.push("Không có cảnh báo trích xuất nào được ghi nhận từ file CV.");
  }

  if (!isActiveCv(params.cv)) {
    items.push("CV này hiện chưa phải là CV đang dùng mặc định. Bạn có thể đặt làm CV đang dùng tại trang Quản lý CV hoặc chọn trực tiếp CV này khi tạo gợi ý việc làm.");
  }

  return items;
}

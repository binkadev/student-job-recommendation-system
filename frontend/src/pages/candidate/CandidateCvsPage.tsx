import { FileText, RefreshCw, UploadCloud, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import { useLocalStorageState } from "../../hooks/useLocalStorageState";
import { useToast } from "../../hooks/useToast";
import { httpClient } from "../../services/api/httpClient";
import { getApiErrorMessage } from "../../utils/apiErrors";
import { getCurrentUserStorageScope } from "../../utils/authStorageScope";

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
  uploadedAt?: string | null;
  updatedAt?: string | null;
}

export function CandidateCvsPage({ mode = "list" }: CandidateCvsPageProps) {
  const { cvId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [active, setActive] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const hiddenCvStorageKey = useMemo(() => `candidate-hidden-cv-ids:${getCurrentUserStorageScope()}`, []);
  const [hiddenCvIds, setHiddenCvIds] = useLocalStorageState<string[]>(hiddenCvStorageKey, []);
  const [deleteTarget, setDeleteTarget] = useState<CvFileResponse | null>(null);
  const cvsQuery = useAsyncData(() => getCandidateCvs(), [reloadKey]);
  const cvs = (cvsQuery.data ?? []).filter((cv) => !hiddenCvIds.includes(String(cv.id)));
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
    const updatedCv = await activateCandidateCv(cv.id);
    showToast({ type: "success", title: "Đã đặt CV đang dùng", message: `${updatedCv.originalFileName} đang là CV được dùng.` });
    setReloadKey((current) => current + 1);
  }

  async function deleteCv(cv: CvFileResponse) {
    try {
      await deleteCandidateCv(cv.id);
      setHiddenCvIds((current) => current.filter((id) => id !== String(cv.id)));
      setDeleteTarget(null);
      setReloadKey((current) => current + 1);
      showToast({ type: "success", title: "Đã xóa CV", message: cv.originalFileName });
    } catch (error) {
      showToast({ type: "error", title: "Không thể xóa CV", message: getApiErrorMessage(error) });
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
        <Card>
          <p className="text-sm text-slate-600">Đang tải danh sách CV...</p>
        </Card>
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

  if (mode === "upload") {
    return (
      <PageContainer>
        <PageHeader title="Tải CV mới" description="Tải lên file PDF hoặc DOCX để phân tích và gợi ý việc làm phù hợp." />
        <div className="max-w-5xl">
          <Card>
            <SectionHeader title="Chọn file CV" description="Hỗ trợ PDF/DOCX. Giao diện chỉ kiểm tra định dạng file, backend là nơi quyết định giới hạn dung lượng cuối cùng." />
            <FileUploader label="Chọn file CV" accept=".pdf,.docx" onFileSelect={handleFile} />

            {selectedFile ? (
              <div className="mt-5 rounded-lg border border-red-200 bg-red-50/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-slate-950">File đã chọn</h2>
                    <p className="mt-2 break-words text-sm font-medium text-slate-800" title={selectedFile.name}>{selectedFile.name}</p>
                  </div>
                  <button type="button" className="rounded-md p-1 text-slate-500 hover:bg-white hover:text-red-600" onClick={() => setSelectedFile(null)} aria-label="Bỏ file đã chọn">
                    <X size={16} />
                  </button>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                  <p><strong>Loại:</strong> {selectedFile.name.toLowerCase().endsWith(".docx") ? "DOCX" : "PDF"}</p>
                  <p><strong>Dung lượng:</strong> {formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
            ) : null}

            {uploadError ? <p className="mt-4 text-sm text-red-600">{uploadError}</p> : null}

            <div className="mt-5">
              <Switch label="Đặt làm CV đang dùng" checked={active} onChange={setActive} disabled={uploading} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" loading={uploading} disabled={uploading} onClick={() => void uploadCv()}>Tải lên</Button>
              <Link to="/candidate/cvs"><Button type="button" variant="secondary" disabled={uploading}>Hủy</Button></Link>
            </div>
          </Card>

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

  return (
    <PageContainer>
      <PageHeader title="Quản lý CV" description="Quản lý các CV dùng để ứng tuyển và cập nhật gợi ý việc làm." />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={`${cvs.length} CV`} />
          {cvs.some((cv) => isActiveCv(cv)) ? <StatusBadge label="Có CV đang dùng" tone="success" /> : null}
        </div>
        <Link to="/candidate/cvs/upload"><Button icon={<UploadCloud size={16} />}>Tải CV mới</Button></Link>
      </div>

      {cvs.length === 0 ? (
        <Card>
          <EmptyState message="Bạn chưa có CV nào." />
          <div className="mt-4">
            <Link to="/candidate/cvs/upload"><Button>Tải CV đầu tiên</Button></Link>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cvs.map((cv) => (
          <Card key={cv.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><FileText size={20} /></div>
                <div className="min-w-0">
                  <h2 className="break-words font-semibold text-slate-950" title={cv.originalFileName || cv.fileName || ""}>{cv.originalFileName || cv.fileName || "CV chưa cập nhật tên"}</h2>
                  <p className="mt-1 text-sm text-slate-500">{getFileType(cv.contentType)} • {formatFileSize(cv.fileSize)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                {isActiveCv(cv) ? <StatusBadge label="Đang dùng" tone="success" /> : <StatusBadge label="Chưa dùng" />}
                <button
                  type="button"
                  className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  disabled={isActiveCv(cv)}
                  title={isActiveCv(cv) ? "Không thể xóa CV đang dùng. Hãy đặt CV khác làm CV đang dùng trước." : "Xóa CV"}
                  onClick={() => {
                    if (!isActiveCv(cv)) setDeleteTarget(cv);
                  }}
                  aria-label="Xóa CV"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-2 text-sm text-slate-600">
              <p>Ngày tải lên: {formatDateTime(cv.uploadedAt)}</p>
              <p className="break-words">Tên file: {cv.originalFileName || cv.fileName || "Chưa cập nhật"}</p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link to={`/candidate/cvs/${cv.id}`}><Button variant="secondary" size="sm">Xem</Button></Link>
              <Button variant="secondary" size="sm" onClick={() => void openCv(cv)}>Mở file</Button>
              <Link to={`/candidate/cvs/${cv.id}/analysis`}><Button variant="secondary" size="sm">{hasCvAnalysis(cv) ? "Phân tích lại" : "Phân tích"}</Button></Link>
              {!isActiveCv(cv) ? <Button variant="secondary" size="sm" onClick={() => void activateCv(cv)}>Đặt làm CV đang dùng</Button> : null}
            </div>
          </Card>
        ))}
      </div>
      <DeleteCvModal cv={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={(cv) => void deleteCv(cv)} />
    </PageContainer>
  );
}

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
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <main className="space-y-5">
          <Card>
            <SectionHeader title="Thông tin file" />
            <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <SummaryItem label="ID" value={String(cv.id)} />
              <SummaryItem label="Tên file gốc" value={cv.originalFileName} />
              <SummaryItem label="Loại nội dung" value={cv.contentType || "Chưa cập nhật"} />
              <SummaryItem label="Dung lượng" value={formatFileSize(cv.fileSize)} />
              <SummaryItem label="Ngày tải lên" value={formatDateTime(cv.uploadedAt)} />
              <SummaryItem label="CV đang dùng" value={isActiveCv(cv) ? "Có" : "Không"} />
            </div>
          </Card>
        </main>
        <aside className="space-y-5">
          <Card>
            <SectionHeader title="Thao tác" />
            <div className="grid gap-2">
              <Link to="/candidate/cvs"><Button variant="secondary" className="w-full">Quay lại danh sách</Button></Link>
              <Link to="/candidate/cvs/upload"><Button className="w-full">Tải CV mới</Button></Link>
              <Button variant="secondary" className="w-full" onClick={() => void openFile()}>Mở file CV</Button>
              {!isActiveCv(cv) ? <Button variant="secondary" className="w-full" onClick={() => void setActive()}>Đặt làm CV đang dùng</Button> : null}
            </div>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}

function DeleteCvModal({ cv, onClose, onConfirm }: { cv: CvFileResponse | null; onClose: () => void; onConfirm: (cv: CvFileResponse) => void }) {
  return (
    <Modal open={Boolean(cv)} title="Xóa CV" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          Bạn có muốn xóa CV <strong>{cv?.originalFileName}</strong> khỏi danh sách hiển thị không?
        </p>
        <p className="text-sm text-slate-500">Chỉ CV chưa từng dùng trong ứng tuyển, gợi ý việc làm hoặc xếp hạng ứng viên mới có thể xóa.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant="danger" onClick={() => cv && onConfirm(cv)}>Có, xóa CV</Button>
        </div>
      </div>
    </Modal>
  );
}

async function getCandidateCvs() {
  const response = await httpClient.get<ApiResponse<CvFileResponse[]>>("/students/me/cv");
  return response.data.data;
}

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
        <Card><p className="text-sm text-slate-600">Đang tải dữ liệu CV...</p></Card>
      </PageContainer>
    );
  }

  if (cvQuery.error) {
    return (
      <PageContainer>
        <ErrorState message={cvQuery.error} />
      </PageContainer>
    );
  }

  if (analysisQuery.error) {
    return (
      <PageContainer>
        <ErrorState message={analysisQuery.error} />
      </PageContainer>
    );
  }

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

  return (
    <PageContainer>
      <PageHeader title={title} description="Xem trạng thái phân tích CV và dữ liệu chỉ hiển thị khi phân tích đã sẵn sàng." />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <main className="space-y-5">
          <Card>
            <SectionHeader title="Thông tin CV" />
            <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <SummaryItem label="ID" value={String(cv.id)} />
              <SummaryItem label="Tên file" value={cv.originalFileName || cv.fileName || "Chưa cập nhật"} />
              <SummaryItem label="Loại nội dung" value={cv.contentType || "Chưa cập nhật"} />
              <SummaryItem label="Dung lượng" value={formatFileSize(cv.fileSize)} />
              <SummaryItem label="CV đang dùng" value={isActiveCv(cv) ? "Có" : "Không"} />
              <SummaryItem label="Trạng thái phân tích" value={analysis?.status ?? "Chưa cập nhật"} />
              <SummaryItem label="Ngày tải lên" value={formatDateTime(analysis?.uploadedAt ?? cv.uploadedAt)} />
              <SummaryItem label="Ngày tạo" value={formatDateTime(cv.createdAt)} />
              <SummaryItem label="Cập nhật" value={formatDateTime(analysis?.updatedAt ?? cv.updatedAt)} />
            </div>
          </Card>

          {analysisFailed ? (
            <Card>
              <SectionHeader title="Phân tích thất bại" />
              <EmptyState message={analysis?.analysisError ?? "CV chưa phân tích thành công. Vui lòng bấm phân tích lại để cập nhật dữ liệu mới."} />
              <div className="mt-4">
                <Button loading={reanalyzing} disabled={reanalyzing} onClick={() => void reanalyzeCv()} icon={<RefreshCw size={16} />}>{analyzeButtonLabel}</Button>
              </div>
            </Card>
          ) : null}

          {!analysisReady && !analysisFailed ? (
            <Card>
              <SectionHeader title="Dữ liệu phân tích" />
              <EmptyState message="CV chưa ở trạng thái READY nên chưa hiển thị nội dung phân tích." />
            </Card>
          ) : null}

          {analysisReady ? (
            <>
              <Card>
                <SectionHeader title="Văn bản đã xử lý" />
                {analysis?.processedText ? (
                  <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-sm text-slate-700">{analysis.processedText}</pre>
                ) : (
                  <EmptyState message="Chưa có văn bản đã xử lý cho CV này." />
                )}
              </Card>

              <Card>
                <SectionHeader title="Kỹ năng trích xuất" />
                {analysis?.skills?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {analysis.skills.map((skill) => <StatusBadge key={skill} label={skill} tone="success" />)}
                  </div>
                ) : (
                  <EmptyState message="Chưa có kỹ năng trích xuất cho CV này." />
                )}
              </Card>

              <Card>
                <SectionHeader title="Dữ liệu trích xuất" />
                {analysis?.extractedText ? (
                  <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-sm text-slate-700">{analysis.extractedText}</pre>
                ) : (
                  <EmptyState message="Chưa có extractedText cho CV này." />
                )}
              </Card>
            </>
          ) : null}
        </main>

        <aside className="space-y-5">
          <Card>
            <SectionHeader title="Trạng thái" />
            <div className="flex flex-wrap gap-2">
              {isActiveCv(cv) ? <StatusBadge label="Đang dùng" tone="success" /> : <StatusBadge label="Chưa dùng" />}
              <StatusBadge label={analysis?.status ?? "Chưa cập nhật"} tone={analysisReady ? "success" : analysisFailed ? "danger" : "warning"} />
              <StatusBadge label={analysisReady ? "Có dữ liệu phân tích" : "Chưa hiển thị dữ liệu"} tone={analysisReady ? "success" : "warning"} />
            </div>
          </Card>
          <Card>
            <SectionHeader title="Thao tác" />
            <div className="grid gap-2">
              <Button className="w-full" loading={reanalyzing} disabled={reanalyzing} onClick={() => void reanalyzeCv()} icon={<RefreshCw size={16} />}>{analyzeButtonLabel}</Button>
              <Link to={`/candidate/cvs/${cv.id}`}><Button variant="secondary" className="w-full">Chi tiết CV</Button></Link>
              <Link to="/candidate/cvs"><Button variant="secondary" className="w-full">Quay lại danh sách</Button></Link>
            </div>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
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

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 break-words font-medium text-slate-900">{value}</p>
    </div>
  );
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
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}


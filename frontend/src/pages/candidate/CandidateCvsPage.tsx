import { FileText, UploadCloud } from "lucide-react";
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
import { Switch } from "../../components/ui/Switch";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { httpClient } from "../../services/api/httpClient";

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
  originalFileName: string;
  storedFileName: string;
  filePath: string;
  contentType: string;
  fileSize: number;
  active: boolean;
  uploadedAt: string;
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
  const cvsQuery = useAsyncData(() => getCandidateCvs(), [reloadKey]);
  const cvs = cvsQuery.data ?? [];
  const selectedCv = useMemo(() => cvs.find((cv) => String(cv.id) === cvId) ?? cvs[0], [cvId, cvs]);

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
      setUploadError("Vui lòng chọn file CV trước khi upload.");
      return;
    }

    setUploading(true);
    try {
      const cv = await uploadCandidateCv(selectedFile, active);
      showToast({ type: "success", title: "Upload CV thành công", message: `${cv.originalFileName} đã được lưu vào backend.` });
      setReloadKey((current) => current + 1);
      navigate(`/candidate/cvs/${cv.id}`);
    } finally {
      setUploading(false);
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
        <PageHeader title="Upload CV mới" description="Tải lên file PDF hoặc DOCX theo API CV của backend." />
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Card>
            <SectionHeader title="Chọn file CV" description="Backend hỗ trợ PDF/DOCX, tối đa theo cấu hình server." />
            <FileUploader label="Chọn file CV" accept=".pdf,.docx" onFileSelect={handleFile} />

            {selectedFile ? (
              <div className="mt-5 rounded-lg border border-slate-200 p-4">
                <h2 className="font-semibold text-slate-950">File đã chọn</h2>
                <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-3">
                  <p><strong>Tên:</strong> {selectedFile.name}</p>
                  <p><strong>Loại:</strong> {selectedFile.name.toLowerCase().endsWith(".docx") ? "DOCX" : "PDF"}</p>
                  <p><strong>Dung lượng:</strong> {formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
            ) : null}

            {uploadError ? <p className="mt-4 text-sm text-red-600">{uploadError}</p> : null}

            <div className="mt-5">
              <Switch label="Đặt làm CV active" checked={active} onChange={setActive} disabled={uploading} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" loading={uploading} disabled={uploading} onClick={() => void uploadCv()}>Upload</Button>
              <Link to="/candidate/cvs"><Button type="button" variant="secondary" disabled={uploading}>Hủy</Button></Link>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Dữ liệu sẽ lưu" />
            <div className="space-y-3 text-sm text-slate-700">
              <InfoRow label="Endpoint" value="POST /api/students/me/cv" />
              <InfoRow label="Form field" value="file" />
              <InfoRow label="Query" value={`active=${active}`} />
              <InfoRow label="Response" value="CvFileResponse" />
            </div>
          </Card>
        </div>
      </PageContainer>
    );
  }

  if (mode === "analysis" || mode === "edit-extracted" || mode === "review") {
    return <UnsupportedCvFeature mode={mode} cv={selectedCv} />;
  }

  if (mode === "detail" && selectedCv) {
    return <CvDetailView cv={selectedCv} />;
  }

  return (
    <PageContainer>
      <PageHeader title="Quản lý CV" description="Danh sách file CV của ứng viên từ API backend." />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={`${cvs.length} CV`} />
          {cvs.some((cv) => cv.active) ? <StatusBadge label="Có CV active" tone="success" /> : null}
        </div>
        <Link to="/candidate/cvs/upload"><Button icon={<UploadCloud size={16} />}>Upload CV mới</Button></Link>
      </div>

      {cvs.length === 0 ? (
        <Card>
          <EmptyState message="Bạn chưa có CV nào." />
          <div className="mt-4">
            <Link to="/candidate/cvs/upload"><Button>Upload CV đầu tiên</Button></Link>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cvs.map((cv) => (
          <Card key={cv.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><FileText size={20} /></div>
                <div>
                  <h2 className="font-semibold text-slate-950">{cv.originalFileName}</h2>
                  <p className="mt-1 text-sm text-slate-500">{getFileType(cv.contentType)} • {formatFileSize(cv.fileSize)}</p>
                </div>
              </div>
              {cv.active ? <StatusBadge label="Active" tone="success" /> : <StatusBadge label="Inactive" />}
            </div>

            <div className="mt-4 grid gap-2 text-sm text-slate-600">
              <p>Upload: {formatDateTime(cv.uploadedAt)}</p>
              <p>Stored file: {cv.storedFileName}</p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link to={`/candidate/cvs/${cv.id}`}><Button variant="secondary" size="sm">Xem</Button></Link>
              <Link to={`/candidate/cvs/${cv.id}/analysis`}><Button variant="secondary" size="sm">Phân tích</Button></Link>
            </div>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}

function CvDetailView({ cv }: { cv: CvFileResponse }) {
  return (
    <PageContainer>
      <PageHeader title="Chi tiết CV" description="Metadata file CV theo dữ liệu backend." />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <main className="space-y-5">
          <Card>
            <SectionHeader title="Thông tin file" />
            <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <SummaryItem label="ID" value={String(cv.id)} />
              <SummaryItem label="Tên file gốc" value={cv.originalFileName} />
              <SummaryItem label="Tên file lưu trữ" value={cv.storedFileName} />
              <SummaryItem label="Content type" value={cv.contentType} />
              <SummaryItem label="Dung lượng" value={formatFileSize(cv.fileSize)} />
              <SummaryItem label="Ngày upload" value={formatDateTime(cv.uploadedAt)} />
              <SummaryItem label="Active" value={cv.active ? "Có" : "Không"} />
              <SummaryItem label="Đường dẫn" value={cv.filePath} />
            </div>
          </Card>
        </main>
        <aside className="space-y-5">
          <Card>
            <SectionHeader title="Thao tác" />
            <div className="grid gap-2">
              <Link to="/candidate/cvs"><Button variant="secondary" className="w-full">Quay lại danh sách</Button></Link>
              <Link to="/candidate/cvs/upload"><Button className="w-full">Upload CV mới</Button></Link>
            </div>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}

function UnsupportedCvFeature({ mode, cv }: { mode: Exclude<NonNullable<CandidateCvsPageProps["mode"]>, "list" | "upload" | "detail">; cv?: CvFileResponse }) {
  const title = mode === "analysis" ? "Phân tích CV" : mode === "edit-extracted" ? "Chỉnh dữ liệu trích xuất" : "Review CV";
  return (
    <PageContainer>
      <PageHeader title={title} description="Backend hiện chưa có API cho chức năng này." />
      <Card>
        <EmptyState message="Chức năng này chưa có endpoint backend nên không hiển thị dữ liệu mock." />
        {cv ? (
          <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
            <p><strong>CV hiện tại:</strong> {cv.originalFileName}</p>
            <p><strong>ID:</strong> {cv.id}</p>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/candidate/cvs"><Button variant="secondary">Quay lại danh sách CV</Button></Link>
          <Link to="/candidate/cvs/upload"><Button>Upload CV mới</Button></Link>
        </div>
      </Card>
    </PageContainer>
  );
}

async function getCandidateCvs() {
  const response = await httpClient.get<ApiResponse<CvFileResponse[]>>("/students/me/cv");
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0">
      <span className="text-slate-500">{label}</span>
      <strong className="max-w-[190px] text-right text-slate-900">{value}</strong>
    </div>
  );
}

function getFileType(contentType: string) {
  if (contentType.includes("pdf")) return "PDF";
  if (contentType.includes("wordprocessingml")) return "DOCX";
  return contentType || "File";
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

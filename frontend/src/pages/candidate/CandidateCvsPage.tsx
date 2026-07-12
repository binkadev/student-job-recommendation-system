import { Eye, FileText, Pencil, RotateCcw, Star, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { FileUploader } from "../../components/ui/FileUploader";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Rating } from "../../components/ui/Rating";
import { Switch } from "../../components/ui/Switch";
import { Textarea } from "../../components/ui/Textarea";
import { CandidateCvsSkeleton } from "../../features/candidate/cvs/CandidateCvsSkeleton";
import { getCandidateCvs, saveCandidateCvs } from "../../features/candidate/cvs/candidateCvService";
import type { CandidateCvAnalysisStatus, CandidateCvItem } from "../../features/candidate/cvs/candidateCvTypes";
import { buildCvAnalysisData, type ConfidenceLevel, type ExtractedField } from "../../features/candidate/cvs/cvAnalysisMockData";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";

interface CandidateCvsPageProps {
  mode?: "list" | "upload" | "detail" | "analysis" | "edit-extracted" | "review";
}

type UploadStep = "idle" | "selected" | "checking" | "uploading" | "uploaded" | "analyzing" | "completed" | "failed";

const statusMap: Record<CandidateCvAnalysisStatus, { label: string; tone: "success" | "warning" | "danger" }> = {
  success: { label: "Phân tích thành công", tone: "success" },
  analyzing: { label: "Đang phân tích", tone: "warning" },
  failed: { label: "Phân tích thất bại", tone: "danger" },
};

const uploadStepLabels: Record<UploadStep, string> = {
  idle: "Chưa chọn file",
  selected: "Đã chọn file",
  checking: "Đang kiểm tra file",
  uploading: "Đang upload",
  uploaded: "Upload thành công",
  analyzing: "Đang phân tích CV",
  completed: "Hoàn thành",
  failed: "Phân tích thất bại",
};

export function CandidateCvsPage({ mode = "list" }: CandidateCvsPageProps) {
  const { cvId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const cvsQuery = useAsyncData(() => getCandidateCvs(), []);
  const [cvs, setCvs] = useState<CandidateCvItem[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState<UploadStep>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);
  const [uploadPublic, setUploadPublic] = useState(true);
  const [simulateAnalysisError, setSimulateAnalysisError] = useState(false);
  const [duplicateFile, setDuplicateFile] = useState<File | null>(null);
  const [renameCv, setRenameCv] = useState<CandidateCvItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CandidateCvItem | null>(null);

  useEffect(() => {
    if (cvsQuery.data) setCvs(cvsQuery.data);
  }, [cvsQuery.data]);

  function persist(next: CandidateCvItem[]) {
    setCvs(next);
    void saveCandidateCvs(next);
  }

  function setDefaultCv(id: string) {
    const next = cvs.map((cv) => ({ ...cv, isDefault: cv.id === id }));
    persist(next);
    showToast({ type: "success", title: "Đã đặt CV mặc định" });
  }

  function togglePublic(id: string, checked: boolean) {
    const next = cvs.map((cv) => cv.id === id ? { ...cv, isPublic: checked, updatedAt: today() } : cv);
    persist(next);
    showToast({ type: "success", title: checked ? "Đã bật công khai CV" : "Đã tắt công khai CV" });
  }

  function analyzeCv(id: string) {
    const analyzing = cvs.map((cv) => cv.id === id ? { ...cv, status: "analyzing" as const, updatedAt: today() } : cv);
    persist(analyzing);
    showToast({ type: "success", title: "Đã bắt đầu phân tích CV" });
    window.setTimeout(() => {
      const completed = analyzing.map((cv) => cv.id === id ? { ...cv, status: "success" as const, score: 80, warnings: ["Nên bổ sung số liệu kết quả công việc."], missingFields: ["Chứng chỉ"], updatedAt: today() } : cv);
      persist(completed);
      showToast({ type: "success", title: "Phân tích CV hoàn tất" });
    }, 1200);
  }

  function confirmAnalysis(id: string) {
    const next = cvs.map((cv) => cv.id === id ? { ...cv, analysisConfirmed: true, updatedAt: today() } : cv);
    persist(next);
    showToast({ type: "success", title: "Đã xác nhận dữ liệu CV", message: "Trạng thái xác nhận đã được cập nhật vào localStorage." });
  }

  function confirmDelete(cv: CandidateCvItem) {
    if (cv.isDefault && cvs.length > 1) {
      showToast({ type: "error", title: "Không thể xóa CV mặc định", message: "Vui lòng chọn CV mặc định mới trước khi xóa." });
      setDeleteTarget(null);
      return;
    }
    const next = cvs.filter((item) => item.id !== cv.id);
    persist(next);
    setDeleteTarget(null);
    showToast({ type: "success", title: cvs.length === 1 ? "Đã xóa CV cuối cùng" : "Đã xóa CV" });
  }

  function openRename(cv: CandidateCvItem) {
    setRenameCv(cv);
    setRenameValue(cv.fileName);
  }

  function saveRename() {
    if (!renameCv || !renameValue.trim()) return;
    const next = cvs.map((cv) => cv.id === renameCv.id ? { ...cv, fileName: renameValue.trim(), updatedAt: today() } : cv);
    persist(next);
    setRenameCv(null);
    setRenameValue("");
    showToast({ type: "success", title: "Đã đổi tên CV" });
  }

  function validateFile(file: File) {
    const valid = [".pdf", ".docx"].some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!valid) return "Chỉ chấp nhận file PDF hoặc DOCX.";
    if (file.size > 5 * 1024 * 1024) return "Dung lượng tối đa là 5MB.";
    return "";
  }

  function handleFile(file: File) {
    setUploadError("");
    setUploadStep("checking");
    const error = validateFile(file);
    if (error) {
      setUploadError(error);
      setUploadStep("idle");
      showToast({ type: "error", title: "File không hợp lệ", message: error });
      return;
    }
    const duplicate = cvs.some((cv) => cv.fileName.toLowerCase() === file.name.toLowerCase());
    if (duplicate) {
      setDuplicateFile(file);
      setUploadStep("idle");
      return;
    }
    selectUploadFile(file, file.name);
  }

  function selectUploadFile(file: File, fileName: string) {
    setSelectedFile(file);
    setUploadFileName(fileName);
    setUploadProgress(0);
    setUploadStep("selected");
  }

  function cancelUpload() {
    setSelectedFile(null);
    setUploadFileName("");
    setUploadProgress(0);
    setUploadStep("idle");
    setUploadError("");
    setDuplicateFile(null);
  }

  function startUpload() {
    if (!selectedFile) {
      setUploadError("Vui lòng chọn file CV trước khi upload.");
      return;
    }
    setUploadStep("uploading");
    setUploadProgress(0);
    const timer = window.setInterval(() => {
      setUploadProgress((current) => {
        if (current >= 100) {
          window.clearInterval(timer);
          finishUpload(selectedFile, uploadFileName);
          return 100;
        }
        return Math.min(100, current + 16);
      });
    }, 220);
  }

  function finishUpload(file: File, fileName: string) {
    setUploadStep("uploaded");
    const newCvId = `cv-${Date.now()}`;
    const newCv: CandidateCvItem = {
      id: newCvId,
      fileName,
      fileType: file.name.toLowerCase().endsWith(".docx") ? "DOCX" : "PDF",
      size: `${Math.max(1, file.size / 1024 / 1024).toFixed(1)} MB`,
      uploadedAt: today(),
      updatedAt: today(),
      status: "analyzing",
      score: 0,
      isDefault: makeDefault || cvs.length === 0,
      isPublic: uploadPublic,
      recruiterViews: 0,
      extractedSkills: [],
      missingFields: ["Đang trích xuất"],
      warnings: ["CV đang chờ phân tích."],
    };
    const nextCvs = [newCv, ...cvs.map((cv) => makeDefault ? { ...cv, isDefault: false } : cv)];
    persist(nextCvs);
    showToast({ type: "success", title: "Upload CV thành công", message: "Hệ thống đang phân tích CV mới." });
    setUploadStep("analyzing");
    window.setTimeout(() => {
      const completedCvs = nextCvs.map((cv) => cv.id === newCvId ? {
        ...cv,
        status: simulateAnalysisError ? "failed" as const : "success" as const,
        score: simulateAnalysisError ? 0 : 79,
        extractedSkills: simulateAnalysisError ? [] : ["React", "TypeScript", "Git"],
        missingFields: simulateAnalysisError ? ["Không đọc được nội dung"] : ["Chứng chỉ"],
        warnings: simulateAnalysisError ? ["Mô phỏng lỗi phân tích trong development mode."] : ["Nên bổ sung số liệu kết quả công việc."],
        updatedAt: today(),
      } : cv);
      persist(completedCvs);
      setUploadStep(simulateAnalysisError ? "failed" : "completed");
      showToast({ type: simulateAnalysisError ? "error" : "success", title: simulateAnalysisError ? "Phân tích CV thất bại" : "Phân tích CV hoàn tất" });
      window.setTimeout(() => navigate(`/candidate/cvs/${newCvId}/analysis`), 500);
    }, 1400);
  }

  if (cvsQuery.loading) {
    return (
      <PageContainer>
        <CandidateCvsSkeleton />
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

  const selectedCv = cvs.find((cv) => cv.id === cvId) ?? cvs[0];

  if (mode === "upload") {
    const uploading = uploadStep === "uploading" || uploadStep === "analyzing";
    return (
      <PageContainer>
        <PageHeader title="Upload CV mới" description="Tải lên một file CV PDF/DOCX, kiểm tra hợp lệ, upload giả lập và phân tích CV trước khi chuyển sang trang kết quả." />
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Card>
            <SectionHeader title="Chọn file CV" description="Chỉ nhận PDF/DOCX, tối đa 5MB và mỗi lần một file." />
            <FileUploader label="Kéo thả hoặc chọn CV từ máy tính" accept=".pdf,.docx" onFileSelect={handleFile} />
            <div
              className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-600"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
            >
              Kéo file vào khu vực này để chọn nhanh.
            </div>

            {selectedFile ? (
              <div className="mt-5 rounded-lg border border-slate-200 p-4">
                <h2 className="font-semibold text-slate-950">File đã chọn</h2>
                <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-3">
                  <p><strong>Tên:</strong> {uploadFileName}</p>
                  <p><strong>Loại:</strong> {selectedFile.name.toLowerCase().endsWith(".docx") ? "DOCX" : "PDF"}</p>
                  <p><strong>Dung lượng:</strong> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
            ) : null}

            {uploadError ? <p className="mt-4 text-sm text-red-600">{uploadError}</p> : null}

            <div className="mt-5 grid gap-4">
              <Switch label="Đặt làm CV mặc định" checked={makeDefault} onChange={setMakeDefault} disabled={uploading} />
              <Switch label="Cho phép nhà tuyển dụng xem" checked={uploadPublic} onChange={setUploadPublic} disabled={uploading} />
              <Switch label="Development error mode: mô phỏng phân tích thất bại" checked={simulateAnalysisError} onChange={setSimulateAnalysisError} disabled={uploading} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" disabled={uploading} loading={uploading} onClick={startUpload}>Upload</Button>
              <Button type="button" variant="secondary" disabled={uploading} onClick={cancelUpload}>Hủy</Button>
            </div>

            {uploadStep !== "idle" ? (
              <div className="mt-5 space-y-3">
                <StatusBadge label={uploadStepLabels[uploadStep]} tone={uploadStep === "failed" ? "danger" : uploadStep === "completed" ? "success" : "warning"} />
                <ProgressBar value={uploadProgress} label={uploadStep === "analyzing" ? "Đang phân tích CV" : "Tiến trình upload"} />
              </div>
            ) : null}
          </Card>

          <Card>
            <SectionHeader title="Luồng trạng thái" />
            <ol className="space-y-3 text-sm text-slate-700">
              {["Chưa chọn file", "Đã chọn file", "Kiểm tra file", "Upload", "Upload thành công", "Phân tích CV", "Hoàn thành"].map((step) => (
                <li key={step} className="rounded-md bg-slate-50 px-3 py-2">{step}</li>
              ))}
            </ol>
          </Card>
        </div>

        <Modal open={Boolean(duplicateFile)} title="File trùng tên" onClose={() => setDuplicateFile(null)}>
          <p className="text-sm text-slate-600">Đã tồn tại CV có tên <strong>{duplicateFile?.name}</strong>. Bạn muốn ghi đè tên cũ hay đổi tên file mới?</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (!duplicateFile) return;
                const next = cvs.filter((cv) => cv.fileName.toLowerCase() !== duplicateFile.name.toLowerCase());
                persist(next);
                selectUploadFile(duplicateFile, duplicateFile.name);
                setDuplicateFile(null);
              }}
            >
              Ghi đè
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (!duplicateFile) return;
                const extension = duplicateFile.name.toLowerCase().endsWith(".docx") ? ".docx" : ".pdf";
                const baseName = duplicateFile.name.replace(/\.(pdf|docx)$/i, "");
                selectUploadFile(duplicateFile, `${baseName}-new${extension}`);
                setDuplicateFile(null);
              }}
            >
              Đổi tên file mới
            </Button>
          </div>
        </Modal>
      </PageContainer>
    );
  }

  if (mode === "analysis" && selectedCv) {
    return <CvAnalysisView cv={selectedCv} onAnalyze={() => analyzeCv(selectedCv.id)} onConfirm={() => confirmAnalysis(selectedCv.id)} />;
  }

  if (mode !== "list" && selectedCv) {
    return <CvDetailView cv={selectedCv} mode={mode} onAnalyze={() => analyzeCv(selectedCv.id)} />;
  }

  const hasAnalyzing = cvs.some((cv) => cv.status === "analyzing");
  const hasFailed = cvs.some((cv) => cv.status === "failed");

  return (
    <PageContainer>
      <PageHeader title="Quản lý CV" description="Quản lý CV đã upload, trạng thái phân tích, điểm CV, CV mặc định và quyền công khai với nhà tuyển dụng." />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {hasAnalyzing ? <StatusBadge label="Có CV đang phân tích" tone="warning" /> : null}
          {hasFailed ? <StatusBadge label="Có CV phân tích thất bại" tone="danger" /> : null}
        </div>
        <Link to="/candidate/cvs/upload"><Button icon={<UploadCloud size={16} />}>Upload CV mới</Button></Link>
      </div>

      {cvs.length === 0 ? (
        <Card>
          <EmptyState message="Bạn chưa có CV nào." />
          <div className="mt-4"><Link to="/candidate/cvs/upload"><Button>Upload CV đầu tiên</Button></Link></div>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cvs.map((cv) => (
          <Card key={cv.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><FileText size={20} /></div>
                <div>
                  <h2 className="font-semibold text-slate-950">{cv.fileName}</h2>
                  <p className="mt-1 text-sm text-slate-500">{cv.fileType} · {cv.size}</p>
                </div>
              </div>
              <StatusBadge label={statusMap[cv.status].label} tone={statusMap[cv.status].tone} />
            </div>

            <div className="mt-4 space-y-3">
              <div className="grid gap-2 text-sm text-slate-600">
                <p>Upload: {cv.uploadedAt}</p>
                <p>Cập nhật: {cv.updatedAt}</p>
                <p className="inline-flex items-center gap-2"><Eye size={16} /> {cv.recruiterViews} lượt nhà tuyển dụng xem</p>
              </div>
              <ProgressBar value={cv.score} label="Điểm CV" />
              <div className="flex flex-wrap gap-2">
                {cv.isDefault ? <StatusBadge label="CV mặc định" tone="success" /> : null}
                <StatusBadge label={cv.isPublic ? "Công khai" : "Riêng tư"} />
              </div>
              <Switch label="Công khai CV" checked={cv.isPublic} onChange={(checked) => togglePublic(cv.id, checked)} />
              <div className="flex flex-wrap gap-2">
                <Link to={`/candidate/cvs/${cv.id}`}><Button variant="secondary" size="sm">Xem</Button></Link>
                <Link to={`/candidate/cvs/${cv.id}/analysis`}><Button variant="secondary" size="sm">Phân tích</Button></Link>
                <Button variant="secondary" size="sm" icon={<RotateCcw size={14} />} onClick={() => analyzeCv(cv.id)}>{cv.status === "failed" ? "Phân tích lại" : "Phân tích CV"}</Button>
                <Button variant="secondary" size="sm" icon={<Star size={14} />} disabled={cv.isDefault} onClick={() => setDefaultCv(cv.id)}>Mặc định</Button>
                <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => openRename(cv)}>Đổi tên</Button>
                <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setDeleteTarget(cv)}>Xóa</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={Boolean(renameCv)} title="Đổi tên CV" onClose={() => setRenameCv(null)}>
        <Input label="Tên CV" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
        <div className="mt-4 flex gap-2"><Button onClick={saveRename}>Lưu tên mới</Button><Button variant="secondary" onClick={() => setRenameCv(null)}>Hủy</Button></div>
      </Modal>

      <Modal open={Boolean(deleteTarget)} title="Xóa CV" onClose={() => setDeleteTarget(null)}>
        <ConfirmDialog
          danger
          title="Xóa CV này?"
          description={deleteTarget && cvs.length === 1 ? "Đây là CV cuối cùng. Sau khi xóa, hệ thống sẽ không còn CV nào để gợi ý việc làm." : "CV sẽ bị xóa khỏi danh sách quản lý."}
          confirmLabel="Xóa"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteTarget ? confirmDelete(deleteTarget) : undefined}
        />
      </Modal>
    </PageContainer>
  );
}

function CvAnalysisView({ cv, onAnalyze, onConfirm }: { cv: CandidateCvItem; onAnalyze: () => void; onConfirm: () => void }) {
  const analysis = buildCvAnalysisData(cv);

  if (cv.status === "analyzing") {
    return (
      <PageContainer>
        <PageHeader title="Đang phân tích CV" description="Hệ thống đang trích xuất dữ liệu, tính điểm và kiểm tra thông tin trong CV." />
        <Card className="max-w-3xl">
          <StatusBadge label={statusMap[cv.status].label} tone={statusMap[cv.status].tone} />
          <div className="mt-5">
            <ProgressBar value={62} label="Đang xử lý dữ liệu CV" />
          </div>
          <p className="mt-4 text-sm text-slate-600">Bạn có thể quay lại sau ít phút để xem kết quả phân tích.</p>
        </Card>
      </PageContainer>
    );
  }

  if (cv.status === "failed") {
    return (
      <PageContainer>
        <PageHeader title="Phân tích CV thất bại" description="Hệ thống chưa thể đọc nội dung CV. Vui lòng phân tích lại hoặc tải CV khác." />
        <Card className="max-w-3xl">
          <StatusBadge label={statusMap[cv.status].label} tone={statusMap[cv.status].tone} />
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            {analysis.warnings.map((warning) => <p key={warning}>Cảnh báo: {warning}</p>)}
            {analysis.missingInfo.map((info) => <p key={info}>Thông tin thiếu: {info}</p>)}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={onAnalyze} icon={<RotateCcw size={16} />}>Phân tích lại</Button>
            <Link to="/candidate/cvs/upload"><Button variant="secondary">Upload CV khác</Button></Link>
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Kết quả phân tích CV" description="Xem điểm CV, dữ liệu trích xuất, thông tin thiếu, cảnh báo và độ tin cậy của từng trường." />
      <Card className="mb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-950">{cv.fileName}</h1>
              <StatusBadge label={statusMap[cv.status].label} tone={statusMap[cv.status].tone} />
              {cv.analysisConfirmed ? <StatusBadge label="Đã xác nhận" tone="success" /> : <StatusBadge label="Chưa xác nhận" tone="warning" />}
            </div>
            <p className="mt-2 text-sm text-slate-600">Ngày phân tích: {analysis.analyzedAt}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/candidate/cvs/${cv.id}/edit-extracted-data`}><Button variant="secondary">Chỉnh sửa dữ liệu</Button></Link>
            <Button onClick={onConfirm}>Xác nhận</Button>
            <Button variant="secondary" icon={<RotateCcw size={16} />} onClick={onAnalyze}>Phân tích lại</Button>
            <Link to={`/candidate/cvs/${cv.id}/review`}><Button variant="secondary">Review CV</Button></Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <main className="space-y-5">
          <Card>
            <SectionHeader title="Tổng quan điểm" />
            <div className="grid gap-4 md:grid-cols-2">
              {analysis.scoreBreakdown.map((item) => (
                <div key={item.label} className="rounded-lg border border-slate-200 p-4">
                  <ProgressBar value={item.value} label={item.label} />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader title="Thông tin cá nhân trích xuất" />
            <ExtractedFieldGrid fields={analysis.personalInfo} />
          </Card>

          <Card>
            <SectionHeader title="Kinh nghiệm trích xuất" />
            <div className="space-y-4">
              {analysis.experiences.map((experience, index) => (
                <div key={`${experience.company.value}-${index}`} className="rounded-lg border border-slate-200 p-4">
                  <ExtractedFieldGrid fields={[experience.company, experience.position, experience.period, experience.description]} />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader title="Học vấn" />
            <ExtractedFieldGrid fields={analysis.education} />
          </Card>

          <Card>
            <SectionHeader title="Kỹ năng" />
            <div className="flex flex-wrap gap-2">
              {analysis.skills.map((skill) => (
                <span key={skill.name} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {skill.name}
                  <ConfidenceBadge level={skill.confidence} />
                </span>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader title="Chứng chỉ và dự án" />
            {analysis.certificates.length || analysis.projects.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Chứng chỉ</h3>
                  <div className="mt-3"><ExtractedFieldGrid fields={analysis.certificates} /></div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Dự án</h3>
                  <div className="mt-3"><ExtractedFieldGrid fields={analysis.projects} /></div>
                </div>
              </div>
            ) : (
              <EmptyState message="Chưa trích xuất được chứng chỉ hoặc dự án." />
            )}
          </Card>
        </main>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <SectionHeader title="Điểm tổng" />
            <ProgressBar value={cv.score} label={`${cv.score}/100`} />
            <div className="mt-4">
              <Rating value={Math.round(cv.score / 20)} />
            </div>
          </Card>

          <Card>
            <SectionHeader title="Thông tin thiếu" />
            <div className="space-y-2 text-sm text-slate-700">
              {analysis.missingInfo.map((item) => <p key={item}>- {item}</p>)}
            </div>
          </Card>

          <Card>
            <SectionHeader title="Cảnh báo" />
            <div className="space-y-2 text-sm text-slate-700">
              {analysis.warnings.map((item) => <p key={item}>- {item}</p>)}
            </div>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}

function ExtractedFieldGrid({ fields }: { fields: ExtractedField[] }) {
  if (!fields.length) return <EmptyState message="Chưa có dữ liệu trích xuất." />;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {fields.map((field) => (
        <div key={`${field.label}-${field.value}`} className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium text-slate-700">{field.label}</p>
            <ConfidenceBadge level={field.confidence} />
          </div>
          <p className="mt-2 text-slate-900">{field.value}</p>
        </div>
      ))}
    </div>
  );
}

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const config: Record<ConfidenceLevel, { label: string; tone: "success" | "warning" | "danger" }> = {
    high: { label: "Cao", tone: "success" },
    medium: { label: "Trung bình", tone: "warning" },
    low: { label: "Thấp", tone: "danger" },
  };
  return <StatusBadge label={config[level].label} tone={config[level].tone} />;
}

function CvDetailView({ cv, mode, onAnalyze }: { cv: CandidateCvItem; mode: NonNullable<CandidateCvsPageProps["mode"]>; onAnalyze: () => void }) {
  const title = mode === "analysis" ? "Kết quả phân tích CV" : mode === "edit-extracted" ? "Chỉnh sửa dữ liệu trích xuất" : mode === "review" ? "Đánh giá CV" : "Chi tiết CV";
  return (
    <PageContainer>
      <PageHeader title={title} description="Xem thông tin CV, trạng thái phân tích, dữ liệu trích xuất và gợi ý cải thiện." />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <main className="space-y-5">
          <Card>
            <SectionHeader title="Thông tin CV" />
            <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <p><strong>Tên file:</strong> {cv.fileName}</p>
              <p><strong>Loại file:</strong> {cv.fileType}</p>
              <p><strong>Dung lượng:</strong> {cv.size}</p>
              <p><strong>Ngày upload:</strong> {cv.uploadedAt}</p>
              <p><strong>Ngày cập nhật:</strong> {cv.updatedAt}</p>
              <p><strong>Trạng thái:</strong> {statusMap[cv.status].label}</p>
            </div>
          </Card>
          <Card>
            <SectionHeader title="Kỹ năng trích xuất" />
            {cv.extractedSkills.length ? <div className="flex flex-wrap gap-2">{cv.extractedSkills.map((skill) => <StatusBadge key={skill} label={skill} />)}</div> : <EmptyState message="Chưa có kỹ năng trích xuất." />}
          </Card>
          {mode === "edit-extracted" ? (
            <Card>
              <SectionHeader title="Chỉnh sửa dữ liệu trích xuất" />
              <Textarea label="Kinh nghiệm và kỹ năng" defaultValue={cv.extractedSkills.join(", ")} />
              <div className="mt-4"><Button>Xác nhận dữ liệu</Button></div>
            </Card>
          ) : null}
          {mode === "review" ? (
            <Card>
              <SectionHeader title="Gợi ý cải thiện CV" />
              <div className="grid gap-4 md:grid-cols-2">
                <ReviewBox title="Điểm mạnh" items={["Kỹ năng kỹ thuật rõ ràng", "CV có cấu trúc dễ đọc", "Có định hướng Frontend cụ thể"]} />
                <ReviewBox title="Cần cải thiện" items={["Bổ sung chứng chỉ", "Thêm số liệu kết quả", "Mô tả dự án chi tiết hơn"]} />
              </div>
            </Card>
          ) : null}
        </main>
        <aside className="space-y-5">
          <Card>
            <SectionHeader title="Điểm CV" />
            <ProgressBar value={cv.score} label="Tổng điểm" />
            <div className="mt-4 space-y-3">
              <Rating value={Math.round(cv.score / 20)} />
              <ProgressBar value={80} label="Nội dung" />
              <ProgressBar value={86} label="Kỹ năng" />
              <ProgressBar value={74} label="Kinh nghiệm" />
            </div>
          </Card>
          <Card>
            <SectionHeader title="Cảnh báo" />
            <div className="space-y-2 text-sm text-slate-700">
              {cv.missingFields.map((field) => <p key={field}>Thiếu: {field}</p>)}
              {cv.warnings.map((warning) => <p key={warning}>Cảnh báo: {warning}</p>)}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={onAnalyze}>Phân tích lại</Button>
              <Link to={`/candidate/cvs/${cv.id}/edit-extracted-data`}><Button size="sm" variant="secondary">Chỉnh dữ liệu</Button></Link>
              <Link to={`/candidate/cvs/${cv.id}/review`}><Button size="sm">Xem đánh giá</Button></Link>
            </div>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}

function ReviewBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h3 className="font-medium text-slate-900">{title}</h3>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </div>
  );
}

function today() {
  return "2026-07-11";
}

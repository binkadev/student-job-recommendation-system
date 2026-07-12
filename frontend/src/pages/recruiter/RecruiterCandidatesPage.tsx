import { useMemo, useState } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { SectionHeader } from "../../components/common/SectionHeader";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Drawer } from "../../components/ui/Drawer";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { Textarea } from "../../components/ui/Textarea";
import { useAuth } from "../../app/providers/AuthProvider";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useLocalStorageState } from "../../hooks/useLocalStorageState";
import { useToast } from "../../hooks/useToast";
import { mockCandidateService } from "../../services/mock";
import type { Candidate } from "../../types/domain";

interface RecruiterCandidatesPageProps {
  mode?: "list" | "detail" | "evaluation" | "pipeline" | "recommended" | "saved" | "search";
}

interface CandidateMeta {
  jobTitle: string;
  appliedAt: string;
  recruiter: string;
}

type CandidateDetailTab = "overview" | "cv" | "application" | "evaluation" | "activity";

const pipelineColumns = ["Mới nhận", "Đang xem xét", "Qua vòng CV", "Phỏng vấn", "Offer", "Đã tuyển", "Không phù hợp"];
const detailTabs: Array<{ value: CandidateDetailTab; label: string }> = [
  { value: "overview", label: "Tổng quan" },
  { value: "cv", label: "CV" },
  { value: "application", label: "Ứng tuyển" },
  { value: "evaluation", label: "Đánh giá" },
  { value: "activity", label: "Hoạt động" },
];

const candidateMetadata: Record<string, CandidateMeta> = {
  "candidate-1": { jobTitle: "Frontend Developer", appliedAt: "2026-07-02", recruiter: "Trần Thị Bình" },
  "candidate-2": { jobTitle: "Backend Developer", appliedAt: "2026-07-03", recruiter: "Đỗ Quốc Huy" },
  "candidate-3": { jobTitle: "Full-stack Developer", appliedAt: "2026-07-04", recruiter: "Nguyễn Minh Đức" },
  "candidate-4": { jobTitle: "UI/UX Designer", appliedAt: "2026-07-05", recruiter: "Trần Thị Bình" },
  "candidate-5": { jobTitle: "Data Analyst Intern", appliedAt: "2026-07-06", recruiter: "Lê Hoàng Phúc" },
};

const jobOptions = ["Frontend Developer", "Backend Developer", "Full-stack Developer", "UI/UX Designer", "Data Analyst Intern"];
const skillOptions = ["React", "TypeScript", "Java", "Spring Boot", "SQL", "Docker", "Figma", "Python"];

export function RecruiterCandidatesPage({ mode = "list" }: RecruiterCandidatesPageProps) {
  const { candidateId } = useParams();
  const { showToast } = useToast();
  const { currentRole } = useAuth();
  const candidatesQuery = useAsyncData(() => mockCandidateService.getCandidates({ pageSize: 100 }), []);
  const [query, setQuery] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [recruiter, setRecruiter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [experienceFilter, setExperienceFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [matchFilter, setMatchFilter] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedRecommendedJob, setSelectedRecommendedJob] = useState("");
  const [matchCandidate, setMatchCandidate] = useState<Candidate | null>(null);
  const [inviteCandidate, setInviteCandidate] = useState<Candidate | null>(null);
  const [inviteJob, setInviteJob] = useState(jobOptions[0]);
  const [inviteSubject, setInviteSubject] = useState("Lời mời ứng tuyển từ NovaTech");
  const [inviteContent, setInviteContent] = useState("Chúng tôi nhận thấy hồ sơ của bạn phù hợp với vị trí đang tuyển và mong muốn trao đổi thêm về cơ hội này.");
  const [inviteDeadline, setInviteDeadline] = useState("2026-07-25");
  const [tagTargetIds, setTagTargetIds] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [rejectTargetIds, setRejectTargetIds] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState("");
  const [interviewCandidate, setInterviewCandidate] = useState<Candidate | null>(null);
  const [interviewDate, setInterviewDate] = useState("2026-07-18");
  const [interviewTime, setInterviewTime] = useState("09:30");
  const [interviewMethod, setInterviewMethod] = useState("Google Meet");
  const [activeDetailTab, setActiveDetailTab] = useState<CandidateDetailTab>(mode === "evaluation" ? "evaluation" : "overview");
  const [page, setPage] = useState(1);
  const [savedIds, setSavedIds] = useLocalStorageState<string[]>("recruiter-saved-candidate-ids", ["candidate-1", "candidate-5"]);
  const [pipeline, setPipeline] = useLocalStorageState<Record<string, string>>("recruiter-pipeline", {});
  const [tagsByCandidate, setTagsByCandidate] = useLocalStorageState<Record<string, string[]>>("recruiter-candidate-tags", {});
  const [notesByCandidate, setNotesByCandidate] = useLocalStorageState<Record<string, string>>("recruiter-candidate-notes", {});

  const candidates = useMemo(() => candidatesQuery.data?.items ?? [], [candidatesQuery.data?.items]);
  const detailCandidate = useMemo(() => candidates.find((candidate) => candidate.id === candidateId) ?? candidates[0], [candidateId, candidates]);
  const activeCandidates = useMemo(() => {
    let result = candidates;
    if (mode === "saved" || savedOnly) result = result.filter((candidate) => savedIds.includes(candidate.id));
    if (mode === "recommended") result = result.filter((candidate) => candidate.profileCompletion >= 80);
    if (query) result = result.filter((candidate) => `${candidate.name} ${candidate.email} ${candidate.desiredPosition} ${candidate.skills.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
    if (jobFilter) result = result.filter((candidate) => getCandidateMeta(candidate).jobTitle === jobFilter);
    if (recruiter) result = result.filter((candidate) => getCandidateMeta(candidate).recruiter === recruiter);
    if (statusFilter) result = result.filter((candidate) => getCandidateStatus(candidate, pipeline) === statusFilter);
    if (experienceFilter) result = result.filter((candidate) => matchExperience(candidate.experienceYears, experienceFilter));
    if (skillFilter) result = result.filter((candidate) => candidate.skills.includes(skillFilter));
    if (locationFilter) result = result.filter((candidate) => candidate.location.toLowerCase().includes(locationFilter.toLowerCase()));
    if (matchFilter) result = result.filter((candidate) => candidate.profileCompletion >= Number(matchFilter));
    if (appliedFrom) result = result.filter((candidate) => getCandidateMeta(candidate).appliedAt >= appliedFrom);
    if (appliedTo) result = result.filter((candidate) => getCandidateMeta(candidate).appliedAt <= appliedTo);
    return result;
  }, [appliedFrom, appliedTo, candidates, experienceFilter, jobFilter, locationFilter, matchFilter, mode, pipeline, query, recruiter, savedIds, savedOnly, skillFilter, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(activeCandidates.length / 8));
  const pagedCandidates = activeCandidates.slice((page - 1) * 8, page * 8);
  const canDragPipeline = currentRole !== "candidate";

  function toggleSaved(id: string) {
    setSavedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    showToast({ type: "success", title: "Đã cập nhật hồ sơ đã lưu" });
  }

  function updateStatus(ids: string[], status: string) {
    if (!status) return;
    if (status === "Không phù hợp") {
      setRejectTargetIds(ids);
      setRejectReason("");
      return;
    }
    const needsConfirm = ids.some((id) => pipeline[id] === "Đã tuyển" && status !== "Đã tuyển");
    if (needsConfirm && !window.confirm("Ứng viên đã ở trạng thái Đã tuyển. Bạn có chắc muốn chuyển về trạng thái trước không?")) return;
    setPipeline((current) => ids.reduce((next, id) => ({ ...next, [id]: status }), current));
    setSelectedIds([]);
    showToast({ type: "success", title: "Đã cập nhật pipeline", message: `${ids.length} ứng viên được chuyển sang ${status}.` });
  }

  function confirmReject() {
    if (!rejectReason.trim()) {
      showToast({ type: "error", title: "Vui lòng nhập lý do từ chối" });
      return;
    }
    setPipeline((current) => rejectTargetIds.reduce((next, id) => ({ ...next, [id]: "Không phù hợp" }), current));
    setRejectTargetIds([]);
    setSelectedIds([]);
    setRejectReason("");
    showToast({ type: "success", title: "Đã từ chối ứng viên", message: "Lý do đã được lưu vào ghi chú tuyển dụng." });
  }

  function openTagModal(ids: string[]) {
    setTagTargetIds(ids);
    setTagInput("");
  }

  function confirmAddTag() {
    const tags = splitValues(tagInput);
    if (!tags.length) return;
    setTagsByCandidate((current) => {
      const next = { ...current };
      tagTargetIds.forEach((id) => {
        next[id] = Array.from(new Set([...(next[id] ?? []), ...tags]));
      });
      return next;
    });
    setTagTargetIds([]);
    setSelectedIds([]);
    showToast({ type: "success", title: "Đã gắn tag ứng viên" });
  }

  function removeTag(candidateIdValue: string, tag: string) {
    setTagsByCandidate((current) => ({ ...current, [candidateIdValue]: (current[candidateIdValue] ?? []).filter((item) => item !== tag) }));
    showToast({ type: "success", title: "Đã xóa tag ứng viên" });
  }

  function bulkSave() {
    setSavedIds((current) => Array.from(new Set([...current, ...selectedIds])));
    showToast({ type: "success", title: "Đã lưu hồ sơ đã chọn" });
    setSelectedIds([]);
  }

  function sendEmail(ids: string[]) {
    showToast({ type: "success", title: "Đã gửi email mock", message: `${ids.length} ứng viên sẽ nhận email theo mẫu tuyển dụng.` });
    setSelectedIds([]);
  }

  function addCandidateToPipeline(id: string) {
    updateStatus([id], "Mới nhận");
    showToast({ type: "success", title: "Đã thêm ứng viên vào pipeline" });
  }

  function openInviteModal(candidate: Candidate) {
    setInviteCandidate(candidate);
    setInviteJob(selectedRecommendedJob || jobOptions[0]);
    setInviteSubject(`Mời ứng tuyển vị trí ${selectedRecommendedJob || jobOptions[0]}`);
    setInviteContent(`Chào ${candidate.name}, chúng tôi nhận thấy hồ sơ của bạn phù hợp với vị trí ${selectedRecommendedJob || jobOptions[0]}. Rất mong có cơ hội trao đổi thêm với bạn.`);
  }

  function sendInvite() {
    if (!inviteCandidate) return;
    showToast({ type: "success", title: "Đã gửi lời mời ứng tuyển", message: `${inviteCandidate.name} - ${inviteJob}` });
    setInviteCandidate(null);
  }

  function createInterview() {
    if (!interviewCandidate) return;
    setPipeline((current) => ({ ...current, [interviewCandidate.id]: "Phỏng vấn" }));
    showToast({ type: "success", title: "Đã tạo lịch phỏng vấn", message: `${interviewCandidate.name} - ${interviewDate} ${interviewTime} qua ${interviewMethod}.` });
    setInterviewCandidate(null);
  }

  function onDragEnd(event: DragEndEvent) {
    const candidateIdValue = String(event.active.id);
    const column = event.over?.id ? String(event.over.id) : "";
    if (!column) return;
    if (column === "Không phù hợp") {
      setRejectTargetIds([candidateIdValue]);
      setRejectReason("");
      return;
    }
    updateStatus([candidateIdValue], column);
  }

  if (candidatesQuery.loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if ((mode === "detail" || mode === "evaluation") && detailCandidate) {
    return (
      <PageContainer>
        <PageHeader title={mode === "evaluation" ? "Đánh giá ứng viên" : "Chi tiết ứng viên"} description="Xem hồ sơ, match score, kỹ năng và ghi chú tuyển dụng của ứng viên." />
        <CandidateDetail
          candidate={detailCandidate}
          saved={savedIds.includes(detailCandidate.id)}
          tags={tagsByCandidate[detailCandidate.id] ?? []}
          note={notesByCandidate[detailCandidate.id] ?? ""}
          status={getCandidateStatus(detailCandidate, pipeline)}
          activeTab={activeDetailTab}
          onTabChange={setActiveDetailTab}
          onSave={toggleSaved}
          onMessage={(candidate) => sendEmail([candidate.id])}
          onInterview={setInterviewCandidate}
          onReject={(id) => updateStatus([id], "Không phù hợp")}
          onStatusChange={(status) => updateStatus([detailCandidate.id], status)}
          onAddTag={(id) => openTagModal([id])}
          onRemoveTag={removeTag}
          onNoteChange={(value) => setNotesByCandidate((current) => ({ ...current, [detailCandidate.id]: value }))}
        />
        <RejectModal open={rejectTargetIds.length > 0} reason={rejectReason} setReason={setRejectReason} onClose={() => setRejectTargetIds([])} onConfirm={confirmReject} />
        <InterviewModal candidate={interviewCandidate} date={interviewDate} time={interviewTime} method={interviewMethod} setDate={setInterviewDate} setTime={setInterviewTime} setMethod={setInterviewMethod} onClose={() => setInterviewCandidate(null)} onConfirm={createInterview} />
        <TagModal open={tagTargetIds.length > 0} value={tagInput} setValue={setTagInput} onClose={() => setTagTargetIds([])} onConfirm={confirmAddTag} />
      </PageContainer>
    );
  }

  if (mode === "recommended") {
    const recommendedCandidates = candidates
      .filter((candidate) => candidate.profileCompletion >= 70)
      .filter((candidate) => !selectedRecommendedJob || matchesRecommendedJob(candidate, selectedRecommendedJob))
      .sort((a, b) => b.profileCompletion - a.profileCompletion);

    return (
      <PageContainer>
        <PageHeader title="Ứng viên được gợi ý" description="Chọn tin tuyển dụng để xem danh sách ứng viên phù hợp theo CV, kỹ năng và mong muốn nghề nghiệp." />
        <Card className="mb-5">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Select label="Tin tuyển dụng đang hoạt động" value={selectedRecommendedJob} onChange={(event) => setSelectedRecommendedJob(event.target.value)} options={[{ label: "Chọn tin tuyển dụng", value: "" }, ...jobOptions.map((value) => ({ label: value, value }))]} />
            <Button className="self-end" variant="secondary" onClick={() => setSelectedRecommendedJob("")}>Đổi lựa chọn</Button>
          </div>
        </Card>

        {!selectedRecommendedJob ? (
          <Card>
            <div className="py-10 text-center">
              <h2 className="text-lg font-semibold text-slate-950">Chưa chọn tin tuyển dụng</h2>
              <p className="mt-2 text-sm text-slate-600">Vui lòng chọn một tin đang hoạt động để hệ thống hiển thị ứng viên được gợi ý.</p>
            </div>
          </Card>
        ) : recommendedCandidates.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {recommendedCandidates.map((candidate) => (
              <RecommendedCandidateCard
                key={candidate.id}
                candidate={candidate}
                jobTitle={selectedRecommendedJob}
                saved={savedIds.includes(candidate.id)}
                onOpen={setSelectedCandidate}
                onSave={toggleSaved}
                onInvite={openInviteModal}
                onMessage={(item) => sendEmail([item.id])}
                onPipeline={(id) => addCandidateToPipeline(id)}
                onBreakdown={setMatchCandidate}
              />
            ))}
          </div>
        ) : (
          <Card>
            <p className="text-sm text-slate-600">Không có ứng viên phù hợp với tin tuyển dụng đã chọn.</p>
          </Card>
        )}

        <CandidateDrawer candidate={selectedCandidate} onClose={() => setSelectedCandidate(null)} onSave={toggleSaved} saved={selectedCandidate ? savedIds.includes(selectedCandidate.id) : false} tags={selectedCandidate ? tagsByCandidate[selectedCandidate.id] ?? [] : []} onInterview={setInterviewCandidate} onReject={(id) => updateStatus([id], "Không phù hợp")} />
        <MatchBreakdownModal candidate={matchCandidate} jobTitle={selectedRecommendedJob} onClose={() => setMatchCandidate(null)} />
        <InviteCandidateModal candidate={inviteCandidate} job={inviteJob} setJob={setInviteJob} subject={inviteSubject} setSubject={setInviteSubject} content={inviteContent} setContent={setInviteContent} deadline={inviteDeadline} setDeadline={setInviteDeadline} onClose={() => setInviteCandidate(null)} onConfirm={sendInvite} />
        <InterviewModal candidate={interviewCandidate} date={interviewDate} time={interviewTime} method={interviewMethod} setDate={setInterviewDate} setTime={setInterviewTime} setMethod={setInterviewMethod} onClose={() => setInterviewCandidate(null)} onConfirm={createInterview} />
      </PageContainer>
    );
  }

  if (mode === "pipeline") {
    return (
      <PageContainer>
        <PageHeader title="Pipeline tuyển dụng" description="Kanban kéo thả ứng viên giữa các cột trạng thái tuyển dụng." />
        <PipelineFilterPanel
          query={query}
          setQuery={setQuery}
          jobFilter={jobFilter}
          setJobFilter={setJobFilter}
          recruiterFilter={recruiter}
          setRecruiterFilter={setRecruiter}
          matchFilter={matchFilter}
          setMatchFilter={setMatchFilter}
        />
        {!canDragPipeline ? <p className="mb-4 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700">Tài khoản hiện tại chỉ được xem pipeline, thao tác kéo thả đang bị khóa.</p> : null}
        {activeCandidates.length ? (
          <DndContext onDragEnd={onDragEnd}>
            <div className="grid gap-4 overflow-x-auto xl:grid-cols-7">
              {pipelineColumns.map((column) => (
                <PipelineColumn key={column} column={column} candidates={activeCandidates.filter((candidate) => getCandidateStatus(candidate, pipeline) === column)} tagsByCandidate={tagsByCandidate} canDrag={canDragPipeline} onOpen={setSelectedCandidate} />
              ))}
            </div>
          </DndContext>
        ) : (
          <Card>
            <p className="text-sm text-slate-600">Không có ứng viên theo filter hiện tại.</p>
          </Card>
        )}
        <CandidateDrawer
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onSave={toggleSaved}
          saved={selectedCandidate ? savedIds.includes(selectedCandidate.id) : false}
          tags={selectedCandidate ? tagsByCandidate[selectedCandidate.id] ?? [] : []}
          note={selectedCandidate ? notesByCandidate[selectedCandidate.id] ?? "" : ""}
          status={selectedCandidate ? getCandidateStatus(selectedCandidate, pipeline) : ""}
          onNoteChange={(id, value) => setNotesByCandidate((current) => ({ ...current, [id]: value }))}
          onStatusChange={(id, status) => updateStatus([id], status)}
          onInterview={setInterviewCandidate}
          onReject={(id) => updateStatus([id], "Không phù hợp")}
        />
        <RejectModal open={rejectTargetIds.length > 0} reason={rejectReason} setReason={setRejectReason} onClose={() => setRejectTargetIds([])} onConfirm={confirmReject} />
        <InterviewModal candidate={interviewCandidate} date={interviewDate} time={interviewTime} method={interviewMethod} setDate={setInterviewDate} setTime={setInterviewTime} setMethod={setInterviewMethod} onClose={() => setInterviewCandidate(null)} onConfirm={createInterview} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={mode === "saved" ? "Hồ sơ đã lưu" : mode === "search" ? "Tìm kiếm ứng viên" : "Quản lý ứng viên"}
        description="Tìm kiếm, lọc, chuyển trạng thái, lưu hồ sơ, gắn tag, gửi email mock và tạo lịch phỏng vấn."
      />
      <FilterPanel
        query={query}
        setQuery={setQuery}
        jobFilter={jobFilter}
        setJobFilter={setJobFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        experienceFilter={experienceFilter}
        setExperienceFilter={setExperienceFilter}
        skillFilter={skillFilter}
        setSkillFilter={setSkillFilter}
        locationFilter={locationFilter}
        setLocationFilter={setLocationFilter}
        matchFilter={matchFilter}
        setMatchFilter={setMatchFilter}
        appliedFrom={appliedFrom}
        setAppliedFrom={setAppliedFrom}
        appliedTo={appliedTo}
        setAppliedTo={setAppliedTo}
        savedOnly={savedOnly}
        setSavedOnly={setSavedOnly}
      />

      {selectedIds.length ? (
        <Card className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-700">Đã chọn {selectedIds.length} ứng viên</p>
            <div className="flex flex-wrap gap-2">
              <Select label="Chuyển trạng thái" value="" onChange={(event) => updateStatus(selectedIds, event.target.value)} options={[{ label: "Chọn trạng thái", value: "" }, ...pipelineColumns.map((value) => ({ label: value, value }))]} />
              <Button variant="secondary" size="sm" className="self-end" onClick={() => openTagModal(selectedIds)}>Gắn tag</Button>
              <Button variant="secondary" size="sm" className="self-end" onClick={() => sendEmail(selectedIds)}>Gửi email</Button>
              <Button variant="secondary" size="sm" className="self-end" onClick={bulkSave}>Lưu hồ sơ</Button>
              <Button variant="danger" size="sm" className="self-end" onClick={() => updateStatus(selectedIds, "Không phù hợp")}>Từ chối</Button>
              <Button variant="secondary" size="sm" className="self-end" onClick={() => setSelectedIds([])}>Bỏ chọn</Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Table
        rows={pagedCandidates}
        getRowKey={(candidate) => candidate.id}
        columns={[
          { key: "select", header: "", render: (candidate) => <input type="checkbox" checked={selectedIds.includes(candidate.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, candidate.id] : current.filter((id) => id !== candidate.id))} /> },
          { key: "candidate", header: "Ứng viên", render: (candidate) => <CandidateCell candidate={candidate} tags={tagsByCandidate[candidate.id] ?? []} /> },
          { key: "application", header: "Ứng tuyển", render: (candidate) => <ApplicationCell candidate={candidate} /> },
          { key: "profile", header: "Hồ sơ", render: (candidate) => <CandidateProfileCell candidate={candidate} /> },
          { key: "status", header: "Trạng thái", render: (candidate) => <StatusBadge label={getCandidateStatus(candidate, pipeline)} tone={candidateStatusTone(getCandidateStatus(candidate, pipeline))} /> },
          { key: "actions", header: "Thao tác", render: (candidate) => <CandidateActions candidate={candidate} saved={savedIds.includes(candidate.id)} onOpen={setSelectedCandidate} onSave={toggleSaved} onInterview={setInterviewCandidate} /> },
        ]}
      />
      <div className="mt-5"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>

      <CandidateDrawer candidate={selectedCandidate} onClose={() => setSelectedCandidate(null)} onSave={toggleSaved} saved={selectedCandidate ? savedIds.includes(selectedCandidate.id) : false} tags={selectedCandidate ? tagsByCandidate[selectedCandidate.id] ?? [] : []} onInterview={setInterviewCandidate} onReject={(id) => updateStatus([id], "Không phù hợp")} />
      <TagModal open={tagTargetIds.length > 0} value={tagInput} setValue={setTagInput} onClose={() => setTagTargetIds([])} onConfirm={confirmAddTag} />
      <RejectModal open={rejectTargetIds.length > 0} reason={rejectReason} setReason={setRejectReason} onClose={() => setRejectTargetIds([])} onConfirm={confirmReject} />
      <InterviewModal candidate={interviewCandidate} date={interviewDate} time={interviewTime} method={interviewMethod} setDate={setInterviewDate} setTime={setInterviewTime} setMethod={setInterviewMethod} onClose={() => setInterviewCandidate(null)} onConfirm={createInterview} />
    </PageContainer>
  );
}

function FilterPanel(props: {
  query: string; setQuery: (value: string) => void;
  jobFilter: string; setJobFilter: (value: string) => void;
  statusFilter: string; setStatusFilter: (value: string) => void;
  experienceFilter: string; setExperienceFilter: (value: string) => void;
  skillFilter: string; setSkillFilter: (value: string) => void;
  locationFilter: string; setLocationFilter: (value: string) => void;
  matchFilter: string; setMatchFilter: (value: string) => void;
  appliedFrom: string; setAppliedFrom: (value: string) => void;
  appliedTo: string; setAppliedTo: (value: string) => void;
  savedOnly: boolean; setSavedOnly: (value: boolean) => void;
}) {
  return (
    <Card className="mb-5">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Input label="Search" value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="Tên, email, kỹ năng..." />
        <Select label="Tin tuyển dụng" value={props.jobFilter} onChange={(event) => props.setJobFilter(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...jobOptions.map((value) => ({ label: value, value }))]} />
        <Select label="Trạng thái" value={props.statusFilter} onChange={(event) => props.setStatusFilter(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...pipelineColumns.map((value) => ({ label: value, value }))]} />
        <Select label="Kinh nghiệm" value={props.experienceFilter} onChange={(event) => props.setExperienceFilter(event.target.value)} options={[{ label: "Tất cả", value: "" }, { label: "0-1 năm", value: "0-1" }, { label: "2-3 năm", value: "2-3" }, { label: "Trên 3 năm", value: "3+" }]} />
        <Select label="Kỹ năng" value={props.skillFilter} onChange={(event) => props.setSkillFilter(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...skillOptions.map((value) => ({ label: value, value }))]} />
        <Input label="Địa điểm" value={props.locationFilter} onChange={(event) => props.setLocationFilter(event.target.value)} />
      </div>
      <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-[160px_180px_180px_auto]">
        <Input label="Match score từ" type="number" min={0} max={100} value={props.matchFilter} onChange={(event) => props.setMatchFilter(event.target.value)} />
        <Input label="Từ ngày" type="date" value={props.appliedFrom} onChange={(event) => props.setAppliedFrom(event.target.value)} />
        <Input label="Đến ngày" type="date" value={props.appliedTo} onChange={(event) => props.setAppliedTo(event.target.value)} />
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
          <input type="checkbox" checked={props.savedOnly} onChange={(event) => props.setSavedOnly(event.target.checked)} />
          Hồ sơ đã lưu
        </label>
      </div>
    </Card>
  );
}

function PipelineFilterPanel(props: {
  query: string; setQuery: (value: string) => void;
  jobFilter: string; setJobFilter: (value: string) => void;
  recruiterFilter: string; setRecruiterFilter: (value: string) => void;
  matchFilter: string; setMatchFilter: (value: string) => void;
}) {
  const recruiterOptions = Array.from(new Set(Object.values(candidateMetadata).map((item) => item.recruiter)));
  return (
    <Card className="mb-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Select label="Tin tuyển dụng" value={props.jobFilter} onChange={(event) => props.setJobFilter(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...jobOptions.map((value) => ({ label: value, value }))]} />
        <Select label="Recruiter" value={props.recruiterFilter} onChange={(event) => props.setRecruiterFilter(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...recruiterOptions.map((value) => ({ label: value, value }))]} />
        <Input label="Search ứng viên" value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="Tên, email, kỹ năng..." />
        <Input label="Match score từ" type="number" min={0} max={100} value={props.matchFilter} onChange={(event) => props.setMatchFilter(event.target.value)} />
      </div>
    </Card>
  );
}

function CandidateCell({ candidate, tags }: { candidate: Candidate; tags: string[] }) {
  return (
    <div className="flex min-w-[220px] items-start gap-3">
      <Avatar name={candidate.name} />
      <div>
        <p className="font-medium text-slate-900">{candidate.name}</p>
        <p className="text-xs text-slate-500">{candidate.email}</p>
        <p className="mt-1 text-xs text-slate-500">{candidate.location} • {candidate.desiredSalary}</p>
        {tags.length ? <div className="mt-2 flex flex-wrap gap-1">{tags.map((tag) => <StatusBadge key={tag} label={tag} />)}</div> : null}
      </div>
    </div>
  );
}

function ApplicationCell({ candidate }: { candidate: Candidate }) {
  const meta = getCandidateMeta(candidate);
  return (
    <div className="min-w-[180px] space-y-1 text-xs text-slate-600">
      <p className="font-medium text-slate-900">{meta.jobTitle}</p>
      <p>Ứng tuyển: {formatDate(meta.appliedAt)}</p>
      <p>Recruiter: {meta.recruiter}</p>
    </div>
  );
}

function CandidateProfileCell({ candidate }: { candidate: Candidate }) {
  return (
    <div className="min-w-[190px] space-y-2">
      <div className="text-xs text-slate-600">
        <p>{candidate.experienceYears} năm kinh nghiệm</p>
        <p>{candidate.location}</p>
      </div>
      <div className="flex flex-wrap gap-1">{candidate.skills.slice(0, 3).map((skill) => <StatusBadge key={skill} label={skill} />)}</div>
      <ProgressBar value={candidate.profileCompletion} label={`${candidate.profileCompletion}%`} />
    </div>
  );
}

function CandidateActions({
  candidate,
  saved,
  onOpen,
  onSave,
  onInterview,
}: {
  candidate: Candidate;
  saved: boolean;
  onOpen: (candidate: Candidate) => void;
  onSave: (id: string) => void;
  onInterview: (candidate: Candidate) => void;
}) {
  return (
    <div className="flex min-w-[150px] flex-wrap gap-2">
      <Button variant="secondary" size="sm" onClick={() => onOpen(candidate)}>Chi tiết</Button>
      <Button variant="secondary" size="sm" onClick={() => onSave(candidate.id)}>{saved ? "Bỏ lưu" : "Lưu"}</Button>
      <Button variant="secondary" size="sm" onClick={() => onInterview(candidate)}>Phỏng vấn</Button>
    </div>
  );
}

function CandidateDetail({
  candidate,
  saved,
  tags,
  note,
  status,
  activeTab,
  onTabChange,
  onSave,
  onMessage,
  onInterview,
  onReject,
  onStatusChange,
  onAddTag,
  onRemoveTag,
  onNoteChange,
}: {
  candidate: Candidate;
  saved: boolean;
  tags: string[];
  note: string;
  status: string;
  activeTab: CandidateDetailTab;
  onTabChange: (tab: CandidateDetailTab) => void;
  onSave: (id: string) => void;
  onMessage: (candidate: Candidate) => void;
  onInterview: (candidate: Candidate) => void;
  onReject: (id: string) => void;
  onStatusChange: (status: string) => void;
  onAddTag: (id: string) => void;
  onRemoveTag: (candidateId: string, tag: string) => void;
  onNoteChange: (value: string) => void;
}) {
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Avatar name={candidate.name} />
            <div>
              <h2 className="text-xl font-semibold text-slate-950">{candidate.name}</h2>
              <p className="text-sm text-slate-600">{candidate.desiredPosition}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                <span>{candidate.location}</span>
                <span>{candidate.experienceYears} năm kinh nghiệm</span>
                <span>{candidate.desiredSalary}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge label={status} tone={candidateStatusTone(status)} />
                <StatusBadge label={`Match ${candidate.profileCompletion}%`} tone="success" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => onSave(candidate.id)}>{saved ? "Bỏ lưu" : "Lưu hồ sơ"}</Button>
            <Button variant="secondary" onClick={() => onMessage(candidate)}>Nhắn tin</Button>
            <Button variant="secondary" onClick={() => onInterview(candidate)}>Tạo phỏng vấn</Button>
            <Button variant="danger" onClick={() => onReject(candidate.id)}>Từ chối</Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap border-b border-slate-200 px-5 pt-4">
              {detailTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => onTabChange(tab.value)}
                  className={`mr-5 border-b-2 pb-3 text-sm font-medium ${activeTab === tab.value ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-900"}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="p-5">
              <CandidateDetailTabContent candidate={candidate} activeTab={activeTab} status={status} />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <Card>
            <SectionHeader title="Tuyển dụng" />
            <div className="space-y-3 text-sm text-slate-700">
              <Select label="Trạng thái pipeline" value={status} onChange={(event) => onStatusChange(event.target.value)} options={pipelineColumns.map((value) => ({ label: value, value }))} />
              <p><strong>Recruiter phụ trách:</strong> {getCandidateMeta(candidate).recruiter}</p>
              <p><strong>Công việc:</strong> {getCandidateMeta(candidate).jobTitle}</p>
              <p><strong>Ngày ứng tuyển:</strong> {formatDate(getCandidateMeta(candidate).appliedAt)}</p>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-2">
              <SectionHeader title="Tags" />
              <Button variant="secondary" size="sm" onClick={() => onAddTag(candidate.id)}>Thêm tag</Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.length ? tags.map((tag) => (
                <button key={tag} type="button" onClick={() => onRemoveTag(candidate.id, tag)} className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:border-red-200 hover:text-red-600">
                  {tag} ×
                </button>
              )) : <p className="text-sm text-slate-500">Chưa có tag.</p>}
            </div>
          </Card>

          <Card>
            <SectionHeader title="Ghi chú nội bộ" />
            <Textarea label="Note" value={note} onChange={(event) => onNoteChange(event.target.value)} placeholder="Thêm ghi chú phỏng vấn, điểm cần kiểm tra, nhận xét nội bộ..." />
          </Card>

          <Card>
            <SectionHeader title="Thao tác" />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => onSave(candidate.id)}>{saved ? "Bỏ lưu" : "Lưu candidate"}</Button>
              <Button variant="secondary" onClick={() => onMessage(candidate)}>Gửi message</Button>
              <Button variant="secondary" onClick={() => onInterview(candidate)}>Tạo interview</Button>
              <Button variant="danger" onClick={() => onReject(candidate.id)}>Từ chối</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CandidateDetailTabContent({ candidate, activeTab, status }: { candidate: Candidate; activeTab: CandidateDetailTab; status: string }) {
  const meta = getCandidateMeta(candidate);
  if (activeTab === "cv") {
    return (
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="font-medium text-slate-900">Preview CV</p>
          <p className="mt-2 text-sm text-slate-500">CV_{candidate.name.replaceAll(" ", "_")}.pdf</p>
          <div className="mx-auto mt-5 h-80 max-w-sm rounded-lg border border-dashed border-slate-300 bg-white" />
          <Button className="mt-5" variant="secondary" onClick={() => undefined}>Download mock</Button>
        </div>
        <div className="space-y-4">
          <Card>
            <SectionHeader title="Điểm CV" />
            <ProgressBar value={candidate.profileCompletion} label="CV score" />
          </Card>
          <Card>
            <SectionHeader title="Kỹ năng trích xuất" />
            <div className="flex flex-wrap gap-2">{candidate.skills.map((skill) => <StatusBadge key={skill} label={skill} />)}</div>
          </Card>
          <Card>
            <SectionHeader title="Cảnh báo CV" />
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
              <li>Thiếu số liệu định lượng trong mô tả dự án.</li>
              <li>Nên bổ sung liên kết portfolio hoặc GitHub.</li>
            </ul>
          </Card>
        </div>
      </div>
    );
  }

  if (activeTab === "application") {
    return (
      <div className="space-y-5">
        <Card>
          <SectionHeader title="Thông tin ứng tuyển" />
          <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
            <p><strong>Công việc:</strong> {meta.jobTitle}</p>
            <p><strong>Ngày ứng tuyển:</strong> {formatDate(meta.appliedAt)}</p>
            <p><strong>Trạng thái:</strong> {status}</p>
            <p><strong>Recruiter:</strong> {meta.recruiter}</p>
          </div>
        </Card>
        <Card><SectionHeader title="Cover letter" /><p className="text-sm leading-6 text-slate-700">Em quan tâm vị trí {meta.jobTitle} vì muốn phát triển sản phẩm có tác động thực tế tới sinh viên và thị trường tuyển dụng. Em có kinh nghiệm với {candidate.skills.slice(0, 3).join(", ")} và sẵn sàng tham gia phỏng vấn trong tuần này.</p></Card>
        <Card><SectionHeader title="Screening answers" /><div className="space-y-3 text-sm text-slate-700"><p><strong>Kinh nghiệm liên quan:</strong> {candidate.experienceYears} năm</p><p><strong>Có thể làm việc theo hình thức yêu cầu:</strong> Có</p><p><strong>Ngày có thể bắt đầu:</strong> Sau 2 tuần</p></div></Card>
        <Card><SectionHeader title="Timeline" /><TimelineItems items={["Đã nộp hồ sơ", "Recruiter đã xem hồ sơ", `Đang ở trạng thái ${status}`]} /></Card>
      </div>
    );
  }

  if (activeTab === "evaluation") {
    return (
      <div className="grid gap-5 md:grid-cols-2">
        <Card><SectionHeader title="Điểm chuyên môn" /><ProgressBar value={Math.min(100, candidate.profileCompletion + 4)} label="Technical" /></Card>
        <Card><SectionHeader title="Kinh nghiệm" /><ProgressBar value={Math.min(100, candidate.experienceYears * 18)} label="Experience" /></Card>
        <Card><SectionHeader title="Giao tiếp" /><ProgressBar value={82} label="Communication" /></Card>
        <Card><SectionHeader title="Culture fit" /><ProgressBar value={78} label="Culture fit" /></Card>
        <Card className="md:col-span-2"><SectionHeader title="Ghi chú đánh giá" /><Textarea label="Ghi chú" defaultValue="Ứng viên có nền tảng phù hợp, cần kiểm tra thêm khả năng làm việc với hệ thống thực tế và quy trình review code." /></Card>
      </div>
    );
  }

  if (activeTab === "activity") {
    return (
      <Card>
        <SectionHeader title="Hoạt động" />
        <TimelineItems items={["Đã xem hồ sơ", `Chuyển trạng thái: ${status}`, "Thêm ghi chú nội bộ", "Tạo lịch phỏng vấn mock", "Gửi email mock cho ứng viên"]} />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card><SectionHeader title="Giới thiệu" /><p className="text-sm leading-6 text-slate-700">{candidate.summary}</p></Card>
      <div className="grid gap-5 md:grid-cols-2">
        <Card><SectionHeader title="Kinh nghiệm" /><p className="text-sm text-slate-700">{candidate.experienceYears} năm phát triển sản phẩm web, từng tham gia dự án nội bộ và sản phẩm khách hàng.</p></Card>
        <Card><SectionHeader title="Học vấn" /><p className="text-sm text-slate-700">{candidate.education}</p></Card>
        <Card><SectionHeader title="Kỹ năng" /><div className="flex flex-wrap gap-2">{candidate.skills.map((skill) => <StatusBadge key={skill} label={skill} />)}</div></Card>
        <Card><SectionHeader title="Chứng chỉ" /><p className="text-sm text-slate-700">React Developer Foundation, TOEIC 750 mock.</p></Card>
        <Card><SectionHeader title="Dự án" /><p className="text-sm text-slate-700">Nền tảng quản lý học tập, dashboard phân tích dữ liệu tuyển dụng, website thương mại điện tử.</p></Card>
        <Card><SectionHeader title="Mong muốn nghề nghiệp" /><p className="text-sm text-slate-700">{candidate.desiredPosition}, {candidate.desiredSalary}, {candidate.availability}.</p></Card>
      </div>
    </div>
  );
}

function TimelineItems({ items }: { items: string[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={item} className="flex gap-3 text-sm text-slate-700">
          <span className="mt-1 h-2 w-2 rounded-full bg-brand-600" />
          <div>
            <p className="font-medium text-slate-900">{item}</p>
            <p className="text-xs text-slate-500">12/07/2026 {String(9 + index).padStart(2, "0")}:00</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PipelineColumn({ column, candidates, tagsByCandidate, canDrag, onOpen }: { column: string; candidates: Candidate[]; tagsByCandidate: Record<string, string[]>; canDrag: boolean; onOpen: (candidate: Candidate) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: column });
  return (
    <div ref={setNodeRef} className={`min-h-96 rounded-lg border p-3 ${isOver ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-slate-50"}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{column}</h2>
        <StatusBadge label={String(candidates.length)} />
      </div>
      <div className="space-y-3">
        {candidates.length ? candidates.map((candidate) => <PipelineCard key={candidate.id} candidate={candidate} tags={tagsByCandidate[candidate.id] ?? []} canDrag={canDrag} onOpen={onOpen} />) : <p className="rounded-lg border border-dashed border-slate-200 bg-white p-3 text-center text-xs text-slate-400">Không có ứng viên</p>}
      </div>
    </div>
  );
}

function PipelineCard({ candidate, tags, canDrag, onOpen }: { candidate: Candidate; tags: string[]; canDrag: boolean; onOpen: (candidate: Candidate) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: candidate.id, disabled: !canDrag });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const meta = getCandidateMeta(candidate);

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(candidate)}
      className={`block w-full rounded-lg border border-slate-200 bg-white p-3 text-left text-sm shadow-sm hover:border-brand-200 ${isDragging ? "opacity-70" : ""}`}
    >
      <div className="flex items-start gap-2">
        <Avatar name={candidate.name} />
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{candidate.name}</p>
          <p className="truncate text-xs text-slate-500">{meta.jobTitle}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <ProgressBar value={candidate.profileCompletion} label="Match" />
        <div className="grid gap-1 text-xs text-slate-500">
          <span>{candidate.experienceYears} năm kinh nghiệm</span>
          <span>Ứng tuyển: {formatDate(meta.appliedAt)}</span>
          <span>Recruiter: {meta.recruiter}</span>
        </div>
        {tags.length ? <div className="flex flex-wrap gap-1">{tags.slice(0, 3).map((tag) => <StatusBadge key={tag} label={tag} />)}</div> : null}
      </div>
    </button>
  );
}

function CandidateDrawer({
  candidate,
  onClose,
  onSave,
  saved,
  tags,
  note = "",
  status = "",
  onNoteChange,
  onStatusChange,
  onInterview,
  onReject,
}: {
  candidate: Candidate | null;
  onClose: () => void;
  onSave: (id: string) => void;
  saved: boolean;
  tags: string[];
  note?: string;
  status?: string;
  onNoteChange?: (id: string, value: string) => void;
  onStatusChange?: (id: string, status: string) => void;
  onInterview: (candidate: Candidate) => void;
  onReject: (id: string) => void;
}) {
  return (
    <Drawer open={Boolean(candidate)} title="Chi tiết ứng viên" onClose={onClose}>
      {candidate ? (
        <div className="space-y-5">
          <div className="flex items-center gap-3"><Avatar name={candidate.name} /><div><h2 className="font-semibold text-slate-950">{candidate.name}</h2><p className="text-sm text-slate-600">{candidate.email}</p></div></div>
          <Card><SectionHeader title="Thông tin hồ sơ" /><p className="text-sm text-slate-700">{candidate.summary}</p><div className="mt-3 flex flex-wrap gap-2">{candidate.skills.map((skillItem) => <StatusBadge key={skillItem} label={skillItem} />)}</div>{tags.length ? <div className="mt-3 flex flex-wrap gap-2">{tags.map((tag) => <StatusBadge key={tag} label={tag} tone="warning" />)}</div> : null}</Card>
          <Card>
            <SectionHeader title="Pipeline" />
            <div className="space-y-3">
              <ProgressBar value={candidate.profileCompletion} label="Điểm phù hợp" />
              <Select label="Chuyển trạng thái" value={status || getCandidateStatus(candidate, {})} onChange={(event) => onStatusChange?.(candidate.id, event.target.value)} options={pipelineColumns.map((value) => ({ label: value, value }))} />
              <Textarea label="Thêm note" value={note} onChange={(event) => onNoteChange?.(candidate.id, event.target.value)} placeholder="Nhập ghi chú về ứng viên..." />
            </div>
          </Card>
          <div className="flex flex-wrap gap-2"><Button onClick={() => onSave(candidate.id)}>{saved ? "Bỏ lưu" : "Lưu ứng viên"}</Button><Button variant="secondary">Gửi tin nhắn</Button><Button variant="secondary" onClick={() => onInterview(candidate)}>Tạo lịch phỏng vấn</Button><Button variant="danger" onClick={() => onReject(candidate.id)}>Từ chối</Button></div>
        </div>
      ) : null}
    </Drawer>
  );
}

function TagModal({ open, value, setValue, onClose, onConfirm }: { open: boolean; value: string; setValue: (value: string) => void; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal open={open} title="Thêm tag ứng viên" onClose={onClose}>
      <Input label="Tag" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Tiềm năng, ưu tiên, cần review" />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Hủy</Button>
        <Button onClick={onConfirm}>Lưu tag</Button>
      </div>
    </Modal>
  );
}

function RejectModal({ open, reason, setReason, onClose, onConfirm }: { open: boolean; reason: string; setReason: (value: string) => void; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal open={open} title="Từ chối ứng viên" onClose={onClose}>
      <Textarea label="Lý do từ chối" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: chưa phù hợp kinh nghiệm dự án..." />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Hủy</Button>
        <Button variant="danger" onClick={onConfirm}>Xác nhận từ chối</Button>
      </div>
    </Modal>
  );
}

function InterviewModal({ candidate, date, time, method, setDate, setTime, setMethod, onClose, onConfirm }: { candidate: Candidate | null; date: string; time: string; method: string; setDate: (value: string) => void; setTime: (value: string) => void; setMethod: (value: string) => void; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal open={Boolean(candidate)} title="Tạo lịch phỏng vấn" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">Ứng viên: <strong>{candidate?.name}</strong></p>
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Ngày phỏng vấn" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <Input label="Giờ" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
          <Select label="Hình thức" value={method} onChange={(event) => setMethod(event.target.value)} options={["Google Meet", "Microsoft Teams", "Tại văn phòng", "Điện thoại"].map((value) => ({ label: value, value }))} />
          <Input label="Người phỏng vấn" defaultValue="Trần Thị Bình" />
        </div>
        <Textarea label="Ghi chú" placeholder="Nội dung cần trao đổi, link CV, yêu cầu chuẩn bị..." />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button onClick={onConfirm}>Tạo lịch</Button>
        </div>
      </div>
    </Modal>
  );
}

function RecommendedCandidateCard({
  candidate,
  jobTitle,
  saved,
  onOpen,
  onSave,
  onInvite,
  onMessage,
  onPipeline,
  onBreakdown,
}: {
  candidate: Candidate;
  jobTitle: string;
  saved: boolean;
  onOpen: (candidate: Candidate) => void;
  onSave: (id: string) => void;
  onInvite: (candidate: Candidate) => void;
  onMessage: (candidate: Candidate) => void;
  onPipeline: (id: string) => void;
  onBreakdown: (candidate: Candidate) => void;
}) {
  const matchedSkills = getMatchedSkills(candidate, jobTitle);
  const missingSkills = getMissingSkills(candidate, jobTitle);
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Avatar name={candidate.name} />
          <div>
            <h2 className="font-semibold text-slate-950">{candidate.name}</h2>
            <p className="text-sm text-slate-600">{candidate.desiredPosition}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>{candidate.location}</span>
              <span>{candidate.experienceYears} năm kinh nghiệm</span>
              <span>{candidate.desiredSalary}</span>
              <span>{candidate.availability}</span>
            </div>
          </div>
        </div>
        <button type="button" onClick={() => onBreakdown(candidate)} className="min-w-[150px] text-left">
          <ProgressBar value={candidate.profileCompletion} label="Match score" />
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-slate-700">Kỹ năng phù hợp</p>
          <div className="mt-2 flex flex-wrap gap-2">{matchedSkills.map((skill) => <StatusBadge key={skill} label={skill} tone="success" />)}</div>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-700">Kỹ năng thiếu</p>
          <div className="mt-2 flex flex-wrap gap-2">{missingSkills.map((skill) => <StatusBadge key={skill} label={skill} tone="warning" />)}</div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => onOpen(candidate)}>Xem chi tiết</Button>
        <Button variant="secondary" size="sm" onClick={() => onSave(candidate.id)}>{saved ? "Bỏ lưu" : "Lưu hồ sơ"}</Button>
        <Button size="sm" onClick={() => onInvite(candidate)}>Gửi lời mời</Button>
        <Button variant="secondary" size="sm" onClick={() => onMessage(candidate)}>Gửi tin nhắn</Button>
        <Button variant="secondary" size="sm" onClick={() => onPipeline(candidate.id)}>Thêm vào pipeline</Button>
      </div>
    </Card>
  );
}

function MatchBreakdownModal({ candidate, jobTitle, onClose }: { candidate: Candidate | null; jobTitle: string; onClose: () => void }) {
  const rows = candidate ? getMatchBreakdown(candidate, jobTitle) : [];
  return (
    <Modal open={Boolean(candidate)} title="Match breakdown" onClose={onClose}>
      {candidate ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-700"><strong>{candidate.name}</strong> phù hợp với vị trí <strong>{jobTitle}</strong>.</p>
          {rows.map((row) => (
            <div key={row.label} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-slate-900">{row.label}</p>
                <StatusBadge label={`${row.score} điểm`} tone={row.score >= 80 ? "success" : "warning"} />
              </div>
              <p className="mt-1 text-xs text-slate-500">Trọng số: {row.weight}%</p>
              <p className="mt-2 text-sm text-slate-700">{row.explanation}</p>
            </div>
          ))}
        </div>
      ) : null}
    </Modal>
  );
}

function InviteCandidateModal({
  candidate,
  job,
  setJob,
  subject,
  setSubject,
  content,
  setContent,
  deadline,
  setDeadline,
  onClose,
  onConfirm,
}: {
  candidate: Candidate | null;
  job: string;
  setJob: (value: string) => void;
  subject: string;
  setSubject: (value: string) => void;
  content: string;
  setContent: (value: string) => void;
  deadline: string;
  setDeadline: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={Boolean(candidate)} title="Gửi lời mời ứng tuyển" onClose={onClose}>
      <div className="space-y-4">
        <Select label="Chọn job" value={job} onChange={(event) => setJob(event.target.value)} options={jobOptions.map((value) => ({ label: value, value }))} />
        <Input label="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
        <Textarea label="Nội dung lời mời" value={content} onChange={(event) => setContent(event.target.value)} />
        <Input label="Hạn phản hồi" type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Preview</p>
          <p className="mt-2">Gửi tới: {candidate?.name}</p>
          <p>Vị trí: {job}</p>
          <p>Tiêu đề: {subject}</p>
          <p className="mt-2 whitespace-pre-line">{content}</p>
          <p className="mt-2 text-xs text-slate-500">Hạn phản hồi: {formatDate(deadline)}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button onClick={onConfirm}>Gửi lời mời</Button>
        </div>
      </div>
    </Modal>
  );
}

function getCandidateMeta(candidate: Candidate): CandidateMeta {
  return candidateMetadata[candidate.id] ?? { jobTitle: candidate.desiredPosition, appliedAt: "2026-07-07", recruiter: "Trần Thị Bình" };
}

function getCandidateStatus(candidate: Candidate, pipeline: Record<string, string>) {
  return pipeline[candidate.id] ?? "Mới nhận";
}

function getJobRequiredSkills(jobTitle: string) {
  if (jobTitle.includes("Frontend")) return ["React", "TypeScript", "HTML", "CSS"];
  if (jobTitle.includes("Backend")) return ["Java", "Spring Boot", "SQL", "Docker"];
  if (jobTitle.includes("Full-stack")) return ["React", "TypeScript", "Java", "SQL"];
  if (jobTitle.includes("UI/UX")) return ["Figma", "UX Research", "Prototype"];
  if (jobTitle.includes("Data")) return ["Python", "SQL", "Dashboard"];
  return ["React", "TypeScript", "SQL"];
}

function getMatchedSkills(candidate: Candidate, jobTitle: string) {
  const requiredSkills = getJobRequiredSkills(jobTitle);
  const matched = requiredSkills.filter((skill) => candidate.skills.includes(skill));
  return matched.length ? matched : candidate.skills.slice(0, 2);
}

function getMissingSkills(candidate: Candidate, jobTitle: string) {
  const missing = getJobRequiredSkills(jobTitle).filter((skill) => !candidate.skills.includes(skill));
  return missing.length ? missing : ["Không có kỹ năng thiếu lớn"];
}

function matchesRecommendedJob(candidate: Candidate, jobTitle: string) {
  return getMatchedSkills(candidate, jobTitle).length > 0 || candidate.profileCompletion >= 80;
}

function getMatchBreakdown(candidate: Candidate, jobTitle: string) {
  const matchedCount = getMatchedSkills(candidate, jobTitle).length;
  return [
    { label: "Kỹ năng", score: Math.min(100, 60 + matchedCount * 10), weight: 35, explanation: `Phù hợp ${matchedCount} kỹ năng chính với yêu cầu của ${jobTitle}.` },
    { label: "Kinh nghiệm", score: Math.min(100, 55 + candidate.experienceYears * 12), weight: 20, explanation: `${candidate.experienceYears} năm kinh nghiệm liên quan tới vị trí ứng tuyển.` },
    { label: "Học vấn", score: candidate.education ? 82 : 60, weight: 15, explanation: "Nền tảng học vấn phù hợp với nhóm ngành công nghệ thông tin." },
    { label: "Địa điểm", score: candidate.location.includes("Hà Nội") || candidate.location.includes("Hồ Chí Minh") ? 90 : 75, weight: 10, explanation: `Địa điểm hiện tại: ${candidate.location}.` },
    { label: "Lương", score: candidate.desiredSalary.includes("triệu") ? 84 : 72, weight: 10, explanation: `Mức lương mong muốn: ${candidate.desiredSalary}.` },
    { label: "Availability", score: candidate.availability.includes("Ngay") ? 92 : 78, weight: 10, explanation: `Trạng thái sẵn sàng: ${candidate.availability}.` },
  ];
}

function matchExperience(years: number, value: string) {
  if (value === "0-1") return years <= 1;
  if (value === "2-3") return years >= 2 && years <= 3;
  if (value === "3+") return years > 3;
  return true;
}

function candidateStatusTone(status: string) {
  if (["Offer", "Đã tuyển"].includes(status)) return "success" as const;
  if (["Không phù hợp"].includes(status)) return "danger" as const;
  if (["Phỏng vấn", "Qua vòng CV"].includes(status)) return "warning" as const;
  return "neutral" as const;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function splitValues(value: string) {
  return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
}

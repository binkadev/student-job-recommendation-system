import { Mail, MessageSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Textarea } from "../../components/ui/Textarea";
import { CandidateApplyFlowModal, type ApplyFlowJob } from "../../features/candidate/apply/CandidateApplyFlowModal";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useLocalStorageState } from "../../hooks/useLocalStorageState";
import { useToast } from "../../hooks/useToast";
import { invitations as invitationSeed } from "../../mocks";
import type { Invitation } from "../../types/domain";
import { mockDelay } from "../../utils/mockDelay";

type InvitationViewStatus = Invitation["status"] | "expired";

interface CandidateInvitation extends Invitation {
  recruiterName: string;
  recruiterEmail: string;
  recruiterTitle: string;
  companySize: string;
  companyIndustry: string;
  jobLocation: string;
  salary: string;
  workMode: "Onsite" | "Hybrid" | "Remote";
  shortMessage: string;
  fullMessage: string;
  fitReasons: string[];
  matchScore: number;
  responseDeadline: string;
  declineReason?: string;
}

const statusLabels: Record<InvitationViewStatus, { label: string; tone: "neutral" | "success" | "warning" | "danger" }> = {
  pending: { label: "Chờ phản hồi", tone: "warning" },
  accepted: { label: "Đã chấp nhận", tone: "success" },
  declined: { label: "Đã từ chối", tone: "danger" },
  expired: { label: "Hết hạn", tone: "neutral" },
};

const invitationMetadata: Record<string, Omit<CandidateInvitation, keyof Invitation>> = {
  "invitation-1": {
    recruiterName: "Trần Thị Bình",
    recruiterEmail: "binh.tran@novatech.vn",
    recruiterTitle: "Recruitment Manager",
    companySize: "150-300 nhân sự",
    companyIndustry: "Công nghệ thông tin",
    jobLocation: "Hà Nội",
    salary: "18 - 28 triệu",
    workMode: "Hybrid",
    shortMessage: "Hồ sơ Frontend của bạn rất phù hợp với đội sản phẩm web.",
    fullMessage:
      "Chúng tôi đang tìm Frontend Developer có kinh nghiệm React, TypeScript và tư duy sản phẩm. Hồ sơ của bạn thể hiện tốt kỹ năng xây dựng giao diện, làm việc với design system và tối ưu trải nghiệm người dùng.",
    fitReasons: ["Kỹ năng React và TypeScript khớp với yêu cầu chính", "CV có dự án giao diện thực tế", "Mong muốn làm Hybrid tại Hà Nội phù hợp với vị trí"],
    matchScore: 91,
    responseDeadline: "2026-07-20",
  },
  "invitation-2": {
    recruiterName: "Đỗ Quốc Huy",
    recruiterEmail: "huy.do@cloudnext.vn",
    recruiterTitle: "Technical Recruiter",
    companySize: "80-150 nhân sự",
    companyIndustry: "Cloud & DevOps",
    jobLocation: "Remote",
    salary: "25 - 40 triệu",
    workMode: "Remote",
    shortMessage: "Chúng tôi muốn trao đổi thêm về kinh nghiệm DevOps của bạn.",
    fullMessage:
      "CloudNext đang mở vị trí DevOps Engineer cho nhóm hạ tầng. Hồ sơ của bạn có Docker, Linux và định hướng cloud nên rất phù hợp để trao đổi sâu hơn.",
    fitReasons: ["Kinh nghiệm Docker và Linux phù hợp", "Có định hướng vận hành hệ thống", "Hình thức Remote phù hợp mong muốn"],
    matchScore: 88,
    responseDeadline: "2026-07-18",
  },
  "invitation-3": {
    recruiterName: "Nguyễn Kim Oanh",
    recruiterEmail: "oanh.nguyen@ecomhub.vn",
    recruiterTitle: "Recruiter",
    companySize: "300+ nhân sự",
    companyIndustry: "Thương mại điện tử",
    jobLocation: "TP. Hồ Chí Minh",
    salary: "14 - 22 triệu",
    workMode: "Onsite",
    shortMessage: "Bạn có kinh nghiệm kiểm thử phù hợp với nhóm QA.",
    fullMessage:
      "EcomHub đánh giá cao kinh nghiệm kiểm thử API, viết test case và làm việc với Jira của bạn. Vị trí QA Engineer cần người có khả năng phối hợp tốt với đội sản phẩm.",
    fitReasons: ["Có kỹ năng API testing", "Đã dùng Jira trong quy trình kiểm thử", "Kinh nghiệm phù hợp nhóm QA"],
    matchScore: 82,
    responseDeadline: "2026-07-09",
  },
};

const invitationTextOverrides: Record<string, Partial<Invitation>> = {
  "invitation-1": { jobTitle: "Frontend Developer", companyName: "Công ty TNHH Công nghệ NovaTech", message: "Hồ sơ của bạn phù hợp với vị trí Frontend Developer." },
  "invitation-2": { jobTitle: "DevOps Engineer", companyName: "Công ty TNHH CloudNext", message: "Chúng tôi muốn trao đổi thêm về kinh nghiệm DevOps của bạn." },
  "invitation-3": { jobTitle: "QA Engineer", companyName: "Công ty Cổ phần EcomHub", message: "Bạn có kinh nghiệm kiểm thử phù hợp với nhóm QA." },
};

export function CandidateInvitationsPage({ mode = "list" }: { mode?: "list" | "detail" }) {
  const { invitationId } = useParams();
  const { showToast } = useToast();
  const invitationsQuery = useAsyncData(() => mockDelay(invitationSeed), []);
  const [storedStatuses, setStoredStatuses] = useLocalStorageState<Record<string, { status: Invitation["status"]; declineReason?: string }>>("candidate-invitation-statuses", {});
  const [filter, setFilter] = useState<InvitationViewStatus | "all">("all");
  const [declineTarget, setDeclineTarget] = useState<CandidateInvitation | null>(null);
  const [applyJob, setApplyJob] = useState<ApplyFlowJob | null>(null);

  const invitations = useMemo(() => {
    return (invitationsQuery.data ?? []).map((invitation) => buildInvitation(invitation, storedStatuses[invitation.id]));
  }, [invitationsQuery.data, storedStatuses]);

  const selectedInvitation = invitationId ? invitations.find((invitation) => invitation.id === invitationId) : invitations[0];

  const filteredInvitations = useMemo(() => {
    return invitations.filter((invitation) => filter === "all" || getViewStatus(invitation) === filter);
  }, [filter, invitations]);

  function updateInvitation(invitation: CandidateInvitation, status: Invitation["status"], declineReason?: string) {
    if (isExpired(invitation)) {
      showToast({ type: "error", title: "Lời mời đã hết hạn", message: "Bạn không thể thao tác với lời mời đã quá hạn phản hồi." });
      return;
    }
    if (invitation.status === "declined" && status !== "declined" && !window.confirm("Lời mời này đã bị từ chối. Bạn có chắc muốn thay đổi phản hồi?")) {
      return;
    }
    setStoredStatuses((current) => ({ ...current, [invitation.id]: { status, declineReason } }));
    showToast({ type: "success", title: status === "accepted" ? "Đã chấp nhận lời mời" : "Đã từ chối lời mời" });
  }

  function acceptInvitation(invitation: CandidateInvitation) {
    updateInvitation(invitation, "accepted");
    if (!isExpired(invitation)) {
      setApplyJob({
        id: invitation.jobId,
        title: invitation.jobTitle,
        companyName: invitation.companyName,
        salary: invitation.salary,
        location: invitation.jobLocation,
        workMode: invitation.workMode,
      });
    }
  }

  if (invitationsQuery.loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (mode === "detail") {
    if (!selectedInvitation) {
      return (
        <PageContainer>
          <PageHeader title="Không tìm thấy lời mời" description="Lời mời ứng tuyển không tồn tại hoặc dữ liệu đã thay đổi." />
          <Card>
            <EmptyState message="Không tìm thấy lời mời ứng tuyển." />
          </Card>
        </PageContainer>
      );
    }

    return (
      <PageContainer>
        <InvitationDetail
          invitation={selectedInvitation}
          onAccept={() => acceptInvitation(selectedInvitation)}
          onDecline={() => setDeclineTarget(selectedInvitation)}
        />
        <DeclineInvitationModal
          invitation={declineTarget}
          onClose={() => setDeclineTarget(null)}
          onConfirm={(invitation, reason) => {
            updateInvitation(invitation, "declined", reason);
            setDeclineTarget(null);
          }}
        />
        <CandidateApplyFlowModal job={applyJob} onClose={() => setApplyJob(null)} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Lời mời ứng tuyển" description="Danh sách lời mời từ nhà tuyển dụng và thao tác phản hồi nhanh." />
      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-[260px_1fr]">
          <Select
            label="Trạng thái"
            value={filter}
            onChange={(event) => setFilter(event.target.value as InvitationViewStatus | "all")}
            options={[
              { label: "Tất cả", value: "all" },
              { label: "Chờ phản hồi", value: "pending" },
              { label: "Đã chấp nhận", value: "accepted" },
              { label: "Đã từ chối", value: "declined" },
              { label: "Hết hạn", value: "expired" },
            ]}
          />
          <p className="self-end text-sm text-slate-600">{filteredInvitations.length} lời mời phù hợp</p>
        </div>
      </Card>

      {filteredInvitations.length === 0 ? (
        <Card>
          <EmptyState message="Không có lời mời ứng tuyển phù hợp." />
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredInvitations.map((invitation) => (
            <InvitationCard
              key={invitation.id}
              invitation={invitation}
              onAccept={() => acceptInvitation(invitation)}
              onDecline={() => setDeclineTarget(invitation)}
            />
          ))}
        </div>
      )}

      <DeclineInvitationModal
        invitation={declineTarget}
        onClose={() => setDeclineTarget(null)}
        onConfirm={(invitation, reason) => {
          updateInvitation(invitation, "declined", reason);
          setDeclineTarget(null);
        }}
      />
      <CandidateApplyFlowModal job={applyJob} onClose={() => setApplyJob(null)} />
    </PageContainer>
  );
}

function InvitationCard({ invitation, onAccept, onDecline }: { invitation: CandidateInvitation; onAccept: () => void; onDecline: () => void }) {
  const status = statusLabels[getViewStatus(invitation)];
  const disabled = getViewStatus(invitation) === "expired";
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={status.label} tone={status.tone} />
            <StatusBadge label={`Match ${invitation.matchScore}%`} tone="success" />
          </div>
          <h2 className="mt-3 font-semibold text-slate-950">{invitation.jobTitle}</h2>
          <p className="mt-1 text-sm text-slate-600">{invitation.companyName}</p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">{invitation.shortMessage}</p>
          <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
            <p>Recruiter: <strong>{invitation.recruiterName}</strong></p>
            <p>Ngày gửi: <strong>{formatDate(invitation.sentAt)}</strong></p>
            <p>Hạn phản hồi: <strong>{formatDate(invitation.responseDeadline)}</strong></p>
            <p>Hình thức: <strong>{invitation.workMode}</strong></p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Link to={`/candidate/invitations/${invitation.id}`}><Button variant="secondary" size="sm">Chi tiết</Button></Link>
          <Button size="sm" onClick={onAccept} disabled={disabled || invitation.status === "accepted"}>Chấp nhận</Button>
          <Button variant="danger" size="sm" onClick={onDecline} disabled={disabled || invitation.status === "declined"}>Từ chối</Button>
        </div>
      </div>
    </Card>
  );
}

function InvitationDetail({ invitation, onAccept, onDecline }: { invitation: CandidateInvitation; onAccept: () => void; onDecline: () => void }) {
  const status = statusLabels[getViewStatus(invitation)];
  const disabled = getViewStatus(invitation) === "expired";
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={status.label} tone={status.tone} />
              <StatusBadge label={`Match ${invitation.matchScore}%`} tone="success" />
            </div>
            <h1 className="mt-3 text-xl font-semibold text-slate-950">{invitation.jobTitle}</h1>
            <p className="mt-1 text-sm text-slate-600">{invitation.companyName}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/candidate/jobs/${invitation.jobId}`}><Button variant="secondary">Xem việc làm</Button></Link>
            <Link to="/candidate/messages"><Button variant="secondary" icon={<MessageSquare size={16} />}>Gửi tin nhắn</Button></Link>
            <Button onClick={onAccept} disabled={disabled || invitation.status === "accepted"}>Chấp nhận</Button>
            <Button variant="danger" onClick={onDecline} disabled={disabled || invitation.status === "declined"}>Từ chối</Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card>
            <SectionHeader title="Nội dung lời mời" description={invitation.shortMessage} />
            <p className="text-sm leading-6 text-slate-700">{invitation.fullMessage}</p>
          </Card>
          <Card>
            <SectionHeader title="Lý do bạn phù hợp" />
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
              {invitation.fitReasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </Card>
          <Card>
            <SectionHeader title="Thông tin việc làm" />
            <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <SummaryItem label="Vị trí" value={invitation.jobTitle} />
              <SummaryItem label="Mức lương" value={invitation.salary} />
              <SummaryItem label="Địa điểm" value={invitation.jobLocation} />
              <SummaryItem label="Hình thức" value={invitation.workMode} />
              <SummaryItem label="Hạn phản hồi" value={formatDate(invitation.responseDeadline)} />
              <SummaryItem label="Match score" value={`${invitation.matchScore}%`} />
            </div>
          </Card>
        </div>
        <aside className="space-y-5">
          <Card>
            <SectionHeader title="Recruiter" />
            <div className="space-y-2 text-sm text-slate-700">
              <p className="font-semibold text-slate-950">{invitation.recruiterName}</p>
              <p>{invitation.recruiterTitle}</p>
              <p className="inline-flex items-center gap-2"><Mail size={16} />{invitation.recruiterEmail}</p>
            </div>
          </Card>
          <Card>
            <SectionHeader title="Công ty" />
            <div className="space-y-2 text-sm text-slate-700">
              <SummaryItem label="Tên công ty" value={invitation.companyName} />
              <SummaryItem label="Ngành" value={invitation.companyIndustry} />
              <SummaryItem label="Quy mô" value={invitation.companySize} />
            </div>
          </Card>
          {invitation.declineReason ? (
            <Card>
              <SectionHeader title="Lý do từ chối đã lưu" />
              <p className="text-sm text-slate-700">{invitation.declineReason}</p>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function DeclineInvitationModal({ invitation, onClose, onConfirm }: { invitation: CandidateInvitation | null; onClose: () => void; onConfirm: (invitation: CandidateInvitation, reason: string) => void }) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (invitation) setReason("");
  }, [invitation]);

  return (
    <Modal open={Boolean(invitation)} title="Từ chối lời mời ứng tuyển" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">Bạn có thể nhập lý do từ chối để nhà tuyển dụng hiểu rõ hơn. Trường này không bắt buộc.</p>
        <Textarea label="Lý do từ chối tùy chọn" value={reason} onChange={(event) => setReason(event.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant="danger" onClick={() => invitation && onConfirm(invitation, reason.trim())}>Từ chối</Button>
        </div>
      </div>
    </Modal>
  );
}

function buildInvitation(invitation: Invitation, stored?: { status: Invitation["status"]; declineReason?: string }): CandidateInvitation {
  const metadata = invitationMetadata[invitation.id];
  return {
    ...invitation,
    ...invitationTextOverrides[invitation.id],
    ...metadata,
    status: stored?.status ?? invitation.status,
    declineReason: stored?.declineReason,
  };
}

function getViewStatus(invitation: CandidateInvitation): InvitationViewStatus {
  if (isExpired(invitation) && invitation.status === "pending") return "expired";
  return invitation.status;
}

function isExpired(invitation: CandidateInvitation) {
  return invitation.responseDeadline < "2026-07-11";
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

import { RecruitingPage } from "../../features/recruiting/RecruitingPage";

export function CandidateInvitationsPage({ mode = "list" }: { mode?: "list" | "detail" }) {
  return <RecruitingPage role="candidate" kind="invitations" mode={mode} />;
}

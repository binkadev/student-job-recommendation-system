import { RecruitingPage } from "../../features/recruiting/RecruitingPage";

export function RecruiterInvitationsPage({ mode = "list" }: { mode?: "list" | "create" | "detail" }) {
  return <RecruitingPage role="recruiter" kind="invitations" mode={mode} />;
}

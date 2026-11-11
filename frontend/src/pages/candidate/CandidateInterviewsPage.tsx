import { RecruitingPage } from "../../features/recruiting/RecruitingPage";

export function CandidateInterviewsPage({ mode = "list" }: { mode?: "list" | "detail" }) {
  return <RecruitingPage role="candidate" kind="interviews" mode={mode} />;
}

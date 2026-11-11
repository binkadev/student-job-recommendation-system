import { RecruitingPage } from "../../features/recruiting/RecruitingPage";

export function RecruiterInterviewsPage({ mode = "list" }: { mode?: "list" | "create" | "detail" }) {
  return <RecruitingPage role="recruiter" kind="interviews" mode={mode} />;
}

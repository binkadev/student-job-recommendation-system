import { Link } from "react-router-dom";

// The URL identifies an application to re-fetch through the owned API, never an authority to invite a Student.
export function InvitationLauncher({ applicationId }: { applicationId: number }) {
  return <Link className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus-visible:ring-4 focus-visible:ring-brand-200" to={`/recruiter/invitations/create?applicationId=${applicationId}`}>Mời ứng tuyển</Link>;
}

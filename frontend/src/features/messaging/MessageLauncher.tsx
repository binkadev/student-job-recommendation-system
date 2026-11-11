import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/feedback/ErrorState";
import { useAuth } from "../../hooks/useAuth";
import { sessionVersion } from "../../services/auth/sessionVersion";
import { useSessionAlive } from "../account/useSessionAlive";
import { useRecruitingMutation } from "../recruiting/useRecruitingRequest";
import { createConversation, messagingError, ownedApplication, positiveId, type MessagingRole } from "./messagingApi";

export function MessageLauncher({ applicationId, role, disabled = false }: { applicationId: number; role: MessagingRole; disabled?: boolean }) {
  const auth = useAuth();
  const allowed = auth.isAuthenticated && auth.currentRole === role && Boolean(auth.currentUser);
  return <Launcher key={`${auth.currentUser?.id}:${sessionVersion()}:${role}:${applicationId}`} applicationId={applicationId} role={role} disabled={disabled || !allowed} />;
}
function Launcher({ applicationId, role, disabled }: { applicationId: number; role: MessagingRole; disabled: boolean }) {
  const navigate = useNavigate(), alive = useSessionAlive(), mutation = useRecruitingMutation();
  const [error, setError] = useState("");
  function open() {
    if (disabled || !positiveId(applicationId)) return;
    setError("");
    void mutation.run(async signal => {
      const application = await ownedApplication(role, applicationId, signal);
      if (!alive() || signal.aborted) throw new Error("Session changed");
      return createConversation(application.id, signal);
    }, conversation => navigate(`/${role}/messages/${conversation.id}`), failure => setError(messagingError(failure)));
  }
  return <div className="min-w-0">
    <Button variant="secondary" disabled={disabled || !positiveId(applicationId)} loading={mutation.pending} onClick={open}>Nhắn tin</Button>
    {error ? <div className="mt-2 max-w-md"><ErrorState message={error} /></div> : null}
  </div>;
}

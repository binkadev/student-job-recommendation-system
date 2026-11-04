import { httpClient } from "../../services/api/httpClient";
import { Button } from "../../components/ui/Button";
import { Switch } from "../../components/ui/Switch";
import { LoadingState } from "../../components/feedback/LoadingState";
import { SettingsRecovery } from "./SettingsRecovery";
import { useSettingsForm } from "./useSettingsForm";

const labels = {
  applicationStatusEnabled: "Thông báo trạng thái ứng tuyển",
  jobStatusEnabled: "Thông báo trạng thái việc làm",
  recommendationEnabled: "Thông báo gợi ý việc làm",
  systemEnabled: "Thông báo hệ thống",
};
type PreferenceKey = keyof typeof labels;
type Preferences = Record<PreferenceKey, boolean> & { revision: number; etag?: string };
async function read(): Promise<Preferences> {
  const response = await httpClient.get<{ data: Preferences }>("/users/me/notification-settings");
  return { ...response.data.data, etag: response.headers.etag };
}
export function NotificationPreferences() {
  const form = useSettingsForm(read, draft => httpClient.put("/users/me/notification-settings",
    Object.fromEntries(Object.keys(labels).map(key => [key, draft[key as PreferenceKey]])),
    { headers: { "If-Match": draft.etag } }),
  (a, b) => Object.keys(labels).every(key => a[key as PreferenceKey] === b[key as PreferenceKey]), "Đã lưu cài đặt thông báo");
  if (form.loading) return <LoadingState />;
  return <section className="space-y-4" aria-label="Cấu hình nhận thông báo">
    <h2 className="font-semibold">Cấu hình nhận thông báo</h2>
    <p className="text-sm text-slate-600">Tùy chọn được lưu trên hệ thống. Hiện chỉ trạng thái ứng tuyển có thông báo tự động; chưa hỗ trợ email, SMS hay push realtime.</p>
    <SettingsRecovery {...form} review={form.review ? Object.fromEntries(Object.entries(labels).map(([key, label]) => [label, form.review![key as PreferenceKey]])) : null}
      onRead={() => void form.readBack()} onReplace={form.replaceWithReview} />
    {form.draft ? <fieldset disabled={form.saving} className="space-y-4">
      <legend className="sr-only">Tùy chọn thông báo</legend>
      {(Object.entries(labels) as [PreferenceKey, string][]).map(([key, label]) => <Switch key={key} label={label}
        checked={form.draft![key]} onChange={value => form.setDraft(current => current && ({ ...current, [key]: value }))} />)}
      <Button loading={form.saving} disabled={form.blocked || !form.draft.etag} onClick={() => void form.save()}>Lưu cài đặt thông báo</Button>
    </fieldset> : null}
  </section>;
}

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PageContainer } from "../../../components/common/PageContainer";
import { SectionHeader } from "../../../components/common/SectionHeader";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import { useAsyncData } from "../../../hooks/useAsyncData";
import { useToast } from "../../../hooks/useToast";
import { httpClient } from "../../../services/api/httpClient";
import { CandidateProfileSkeleton } from "./CandidateProfileSkeleton";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

type JobType = "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT";

interface StudentProfileResponse {
  id: number;
  studentId: number;
  headline: string | null;
  summary: string | null;
  education: string | null;
  experience: string | null;
  projects: string | null;
  targetPosition: string | null;
  preferredLocation: string | null;
  preferredJobType: JobType | null;
  rawText: string | null;
  processedText: string | null;
  profileCompleteness: number | null;
  updatedAt: string | null;
}

const jobTypeOptions: Array<{ label: string; value: JobType }> = [
  { label: "Toàn thời gian", value: "FULL_TIME" },
  { label: "Bán thời gian", value: "PART_TIME" },
  { label: "Thực tập", value: "INTERNSHIP" },
  { label: "Hợp đồng", value: "CONTRACT" },
];

const schema = z.object({
  targetPosition: z.string().max(255, "Vị trí mong muốn tối đa 255 ký tự."),
  preferredLocation: z.string().max(255, "Địa điểm mong muốn tối đa 255 ký tự."),
  preferredJobType: z.enum(["FULL_TIME", "PART_TIME", "INTERNSHIP", "CONTRACT"]),
});

type PreferenceFormValues = z.infer<typeof schema>;

export function CandidatePreferencesView() {
  const { showToast } = useToast();
  const profileQuery = useAsyncData(() => getStudentProfile(), []);
  const profile = profileQuery.data;

  const defaultValues = useMemo<PreferenceFormValues | undefined>(() => profile ? ({
    targetPosition: profile.targetPosition ?? "",
    preferredLocation: profile.preferredLocation ?? "",
    preferredJobType: profile.preferredJobType ?? "FULL_TIME",
  }) : undefined, [profile]);

  const { register, handleSubmit, formState: { errors, isSubmitting }, watch, reset } = useForm<PreferenceFormValues>({
    resolver: zodResolver(schema),
    values: defaultValues,
  });

  if (profileQuery.loading) {
    return (
      <PageContainer>
        <CandidateProfileSkeleton />
      </PageContainer>
    );
  }

  if (profileQuery.error || !profile || !defaultValues) {
    return (
      <PageContainer>
        <ErrorState message={profileQuery.error ?? "Không thể tải thiết lập mong muốn nghề nghiệp."} />
      </PageContainer>
    );
  }

  const currentProfile = profile;
  const watchedValues = watch();

  async function onSubmit(values: PreferenceFormValues) {
    const updatedProfile = await updateCareerPreferences(currentProfile, values);
    profileQuery.setData(updatedProfile);
    reset({
      targetPosition: updatedProfile.targetPosition ?? "",
      preferredLocation: updatedProfile.preferredLocation ?? "",
      preferredJobType: updatedProfile.preferredJobType ?? values.preferredJobType,
    });
    showToast({ type: "success", title: "Đã lưu mong muốn nghề nghiệp", message: "Dữ liệu đã được cập nhật lên backend." });
  }

  return (
    <PageContainer>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Mong muốn nghề nghiệp</h1>
          <p className="mt-1 text-sm text-slate-600">Thiết lập vị trí, địa điểm và loại hình công việc theo trường dữ liệu hiện có trong hồ sơ ứng viên.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <main className="space-y-5">
          <Card>
            <SectionHeader title="Thông tin mong muốn" />
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Vị trí mong muốn" error={errors.targetPosition?.message} {...register("targetPosition")} />
              <Input label="Địa điểm mong muốn" error={errors.preferredLocation?.message} {...register("preferredLocation")} />
              <div className="md:col-span-2">
                <Select label="Loại hình công việc" options={jobTypeOptions} error={errors.preferredJobType?.message} {...register("preferredJobType")} />
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Dữ liệu hồ sơ đang được giữ nguyên" description="Các trường này thuộc cùng API hồ sơ và sẽ không bị thay đổi khi lưu mong muốn nghề nghiệp." />
            <div className="grid gap-4">
              <ReadonlyField label="Giới thiệu" value={profile.summary} />
              <ReadonlyField label="Học vấn" value={profile.education} />
              <ReadonlyField label="Kinh nghiệm" value={profile.experience} />
              <ReadonlyField label="Dự án" value={profile.projects} />
            </div>
          </Card>
        </main>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <SectionHeader title="Xem trước" description="Tóm tắt dữ liệu sẽ lưu vào bảng student_profiles." />
            <div className="space-y-3 text-sm text-slate-700">
              <PreviewRow label="Vị trí" value={watchedValues.targetPosition || "Chưa nhập"} />
              <PreviewRow label="Địa điểm" value={watchedValues.preferredLocation || "Chưa nhập"} />
              <PreviewRow label="Loại hình" value={getJobTypeLabel(watchedValues.preferredJobType)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {watchedValues.targetPosition ? <StatusBadge label="Có vị trí mong muốn" tone="success" /> : null}
              {watchedValues.preferredLocation ? <StatusBadge label="Có địa điểm" tone="success" /> : null}
              {watchedValues.preferredJobType ? <StatusBadge label={getJobTypeLabel(watchedValues.preferredJobType)} /> : null}
            </div>
          </Card>

          <Card>
            <Button type="submit" className="w-full" icon={<Save size={16} />} loading={isSubmitting}>Lưu thiết lập</Button>
          </Card>
        </aside>
      </form>
    </PageContainer>
  );
}

async function getStudentProfile() {
  const response = await httpClient.get<ApiResponse<StudentProfileResponse>>("/students/me/profile");
  return response.data.data;
}

async function updateCareerPreferences(profile: StudentProfileResponse, values: PreferenceFormValues) {
  const response = await httpClient.put<ApiResponse<StudentProfileResponse>>("/students/me/profile", {
    summary: profile.summary,
    education: profile.education,
    experience: profile.experience,
    projects: profile.projects,
    targetPosition: emptyToNull(values.targetPosition),
    preferredLocation: emptyToNull(values.preferredLocation),
    preferredJobType: values.preferredJobType,
  });
  return response.data.data;
}

function ReadonlyField({ label, value }: { label: string; value: string | null }) {
  return (
    <Textarea label={label} value={value ?? ""} rows={3} disabled />
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0">
      <span className="text-slate-500">{label}</span>
      <strong className="max-w-[190px] text-right text-slate-900">{value}</strong>
    </div>
  );
}

function getJobTypeLabel(value: JobType) {
  return jobTypeOptions.find((option) => option.value === value)?.label ?? value;
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

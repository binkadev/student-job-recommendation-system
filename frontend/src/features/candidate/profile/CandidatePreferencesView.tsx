import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Briefcase, Save, Sparkles } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
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
import { getApiErrorMessage } from "../../../utils/apiErrors";
import { CandidateProfileSkeleton } from "./CandidateProfileSkeleton";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

type JobType = "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT";

interface StudentProfileResponse {
  profileEtag: string;
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const saving = useRef(false);
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
    if (saving.current) return;
    saving.current = true;
    setSaveError(null);
    try {
      const updatedProfile = await updateCareerPreferences(currentProfile, values);
      profileQuery.setData(updatedProfile);
      reset({
        targetPosition: updatedProfile.targetPosition ?? "",
        preferredLocation: updatedProfile.preferredLocation ?? "",
        preferredJobType: updatedProfile.preferredJobType ?? values.preferredJobType,
      });
      showToast({ type: "success", title: "Đã lưu mong muốn nghề nghiệp", message: "Dữ liệu đã được cập nhật." });
    } catch (error) {
      setSaveError(getApiErrorMessage(error, "Không thể lưu mong muốn nghề nghiệp. Vui lòng thử lại."));
    } finally {
      saving.current = false;
    }
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* NOVA MOTION Hero Banner */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0C111C] p-6 text-white shadow-xl md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-teal-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-xs font-semibold text-teal-300 backdrop-blur-sm">
                <Briefcase className="h-3.5 w-3.5 text-teal-300" />
                <span>MONG MUỐN NGHỀ NGHIỆP</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                Thiết lập mong muốn nghề nghiệp
              </h1>
              <p className="text-sm leading-relaxed text-slate-300">
                Thiết lập vị trí, địa điểm và loại hình công việc mong muốn để tối ưu hóa thuật toán gợi ý việc làm.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link to="/candidate/profile">
                <Button
                  variant="secondary"
                  className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20"
                  icon={<ArrowLeft className="h-4 w-4" />}
                >
                  Quay lại hồ sơ
                </Button>
              </Link>
              <Link to="/candidate/jobs/recommended">
                <Button
                  className="rounded-xl bg-[#D4F933] font-semibold text-[#0C111C] shadow-sm hover:bg-[#C2E82E]"
                  icon={<Sparkles className="h-4 w-4" />}
                >
                  Việc làm gợi ý
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {saveError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 lg:col-span-2">{saveError}</p> : null}
        <div className="space-y-5">
          <Card>
            <SectionHeader title="Thông tin mong muốn" />
            <fieldset disabled={isSubmitting} className="grid min-w-0 gap-4 md:grid-cols-2">
              <Input label="Vị trí mong muốn" error={errors.targetPosition?.message} {...register("targetPosition")} />
              <Input label="Địa điểm mong muốn" error={errors.preferredLocation?.message} {...register("preferredLocation")} />
              <div className="md:col-span-2">
                <Select label="Loại hình công việc" options={jobTypeOptions} error={errors.preferredJobType?.message} {...register("preferredJobType")} />
              </div>
            </fieldset>
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
        </div>

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
      </div>
    </PageContainer>
  );
}

async function getStudentProfile() {
  const response = await httpClient.get<ApiResponse<StudentProfileResponse>>("/students/me/profile");
  return { ...response.data.data, profileEtag: response.headers.etag };
}

async function updateCareerPreferences(profile: StudentProfileResponse, values: PreferenceFormValues) {
  const response = await httpClient.put<ApiResponse<StudentProfileResponse>>("/students/me/profile", {
    targetPosition: values.targetPosition.trim(),
    preferredLocation: values.preferredLocation.trim(),
    preferredJobType: values.preferredJobType,
  }, { headers: { "If-Match": profile.profileEtag } });
  return { ...response.data.data, profileEtag: response.headers.etag };
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

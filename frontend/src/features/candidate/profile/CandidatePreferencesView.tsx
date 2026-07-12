import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, RotateCcw, Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PageContainer } from "../../../components/common/PageContainer";
import { SectionHeader } from "../../../components/common/SectionHeader";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { MultiSelect } from "../../../components/ui/MultiSelect";
import { Select } from "../../../components/ui/Select";
import { Switch } from "../../../components/ui/Switch";
import { useAsyncData } from "../../../hooks/useAsyncData";
import { useToast } from "../../../hooks/useToast";
import { CandidateProfileSkeleton } from "./CandidateProfileSkeleton";
import { getCandidateCareerPreferences, updateCandidateCareerPreferences } from "./candidatePreferencesService";
import type { CandidateCareerPreferences } from "./candidatePreferencesTypes";

const schema = z.object({
  salaryMin: z.number().min(0, "Lương tối thiểu không hợp lệ."),
  salaryMax: z.number().min(0, "Lương tối đa không hợp lệ."),
  currency: z.enum(["VND", "USD"]),
  availableFrom: z.string().min(1, "Vui lòng chọn ngày có thể bắt đầu."),
  willingToTravel: z.boolean(),
  willingToRelocate: z.boolean(),
  internationalRemote: z.boolean(),
}).refine((value) => value.salaryMax >= value.salaryMin, {
  message: "Lương tối đa phải lớn hơn hoặc bằng lương tối thiểu.",
  path: ["salaryMax"],
}).refine((value) => new Date(value.availableFrom) >= new Date("2026-01-01"), {
  message: "Ngày bắt đầu không được ở quá xa trong quá khứ.",
  path: ["availableFrom"],
});

type PreferenceFormValues = z.infer<typeof schema>;

export function CandidatePreferencesView() {
  const { showToast } = useToast();
  const preferencesQuery = useAsyncData(() => getCandidateCareerPreferences(), []);
  const data = preferencesQuery.data;
  const [desiredPositions, setDesiredPositions] = useState<string[]>([]);
  const [positionInput, setPositionInput] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [jobTypes, setJobTypes] = useState<string[]>([]);
  const [workModes, setWorkModes] = useState<string[]>([]);
  const [excludedKeywords, setExcludedKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [listError, setListError] = useState("");

  const defaultValues = useMemo<PreferenceFormValues | undefined>(() => data ? ({
    salaryMin: data.preferences.salaryMin,
    salaryMax: data.preferences.salaryMax,
    currency: data.preferences.currency,
    availableFrom: data.preferences.availableFrom,
    willingToTravel: data.preferences.willingToTravel,
    willingToRelocate: data.preferences.willingToRelocate,
    internationalRemote: data.preferences.internationalRemote,
  }) : undefined, [data]);

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, watch, setValue } = useForm<PreferenceFormValues>({
    resolver: zodResolver(schema),
    values: defaultValues,
  });

  useEffect(() => {
    if (!data) return;
    setDesiredPositions(data.preferences.desiredPositions);
    setIndustries(data.preferences.industries);
    setLevels(data.preferences.levels);
    setLocations(data.preferences.locations);
    setJobTypes(data.preferences.jobTypes);
    setWorkModes(data.preferences.workModes);
    setExcludedKeywords(data.preferences.excludedKeywords);
  }, [data]);

  if (preferencesQuery.loading) {
    return (
      <PageContainer>
        <CandidateProfileSkeleton />
      </PageContainer>
    );
  }

  if (preferencesQuery.error || !data || !defaultValues) {
    return (
      <PageContainer>
        <ErrorState message={preferencesQuery.error ?? "Không thể tải thiết lập mong muốn nghề nghiệp."} />
      </PageContainer>
    );
  }

  const watchedValues = watch();

  function addPosition() {
    const value = positionInput.trim();
    if (!value) return;
    if (!desiredPositions.includes(value)) setDesiredPositions((current) => [...current, value]);
    setPositionInput("");
  }

  function addKeyword() {
    const value = keywordInput.trim();
    if (!value) return;
    if (!excludedKeywords.includes(value)) setExcludedKeywords((current) => [...current, value]);
    setKeywordInput("");
  }

  function resetToDefault() {
    if (!data) return;
    const defaults = data.defaults;
    reset({
      salaryMin: defaults.salaryMin,
      salaryMax: defaults.salaryMax,
      currency: defaults.currency,
      availableFrom: defaults.availableFrom,
      willingToTravel: defaults.willingToTravel,
      willingToRelocate: defaults.willingToRelocate,
      internationalRemote: defaults.internationalRemote,
    });
    setDesiredPositions(defaults.desiredPositions);
    setIndustries(defaults.industries);
    setLevels(defaults.levels);
    setLocations(defaults.locations);
    setJobTypes(defaults.jobTypes);
    setWorkModes(defaults.workModes);
    setExcludedKeywords(defaults.excludedKeywords);
    setListError("");
    showToast({ type: "success", title: "Đã reset về dữ liệu ban đầu" });
  }

  async function onSubmit(values: PreferenceFormValues) {
    if (!desiredPositions.length) {
      setListError("Phải có ít nhất một vị trí mong muốn.");
      return;
    }
    if (!jobTypes.length) {
      setListError("Phải chọn ít nhất một loại hình công việc.");
      return;
    }

    const payload: CandidateCareerPreferences = {
      desiredPositions,
      industries,
      levels,
      salaryMin: values.salaryMin,
      salaryMax: values.salaryMax,
      currency: values.currency,
      locations,
      jobTypes,
      workModes,
      availableFrom: values.availableFrom,
      willingToTravel: values.willingToTravel,
      willingToRelocate: values.willingToRelocate,
      internationalRemote: values.internationalRemote,
      excludedKeywords,
    };

    await updateCandidateCareerPreferences(payload);
    setListError("");
    showToast({ type: "success", title: "Đã lưu mong muốn nghề nghiệp", message: "Dữ liệu đã được lưu vào localStorage." });
  }

  return (
    <PageContainer>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Mong muốn nghề nghiệp</h1>
          <p className="mt-1 text-sm text-slate-600">Thiết lập vị trí, ngành nghề, địa điểm, mức lương và hình thức làm việc mong muốn.</p>
        </div>
        <Button type="button" variant="secondary" icon={<RotateCcw size={16} />} onClick={resetToDefault}>Reset dữ liệu ban đầu</Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <main className="space-y-5">
          <Card>
            <SectionHeader title="Vị trí và ngành nghề" />
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Vị trí mong muốn</label>
                <div className="mt-1 flex gap-2">
                  <Input label="Thêm vị trí" value={positionInput} onChange={(event) => setPositionInput(event.target.value)} placeholder="Frontend Developer..." />
                  <Button type="button" className="self-end" icon={<Plus size={16} />} onClick={addPosition}>Thêm</Button>
                </div>
                <ChipList items={desiredPositions} onRemove={(item) => setDesiredPositions((current) => current.filter((value) => value !== item))} />
              </div>
              <MultiSelect label="Ngành nghề" value={industries} onChange={setIndustries} options={data.options.industries.map((value) => ({ label: value, value }))} />
              <MultiSelect label="Cấp bậc" value={levels} onChange={setLevels} options={data.options.levels.map((value) => ({ label: value, value }))} />
            </div>
          </Card>

          <Card>
            <SectionHeader title="Lương và địa điểm" />
            <div className="grid gap-4 md:grid-cols-3">
              <Input label="Mức lương tối thiểu" type="number" error={errors.salaryMin?.message} {...register("salaryMin", { valueAsNumber: true })} />
              <Input label="Mức lương tối đa" type="number" error={errors.salaryMax?.message} {...register("salaryMax", { valueAsNumber: true })} />
              <Select label="Tiền tệ" error={errors.currency?.message} options={data.options.currencies.map((value) => ({ label: value, value }))} {...register("currency")} />
            </div>
            <div className="mt-4">
              <MultiSelect label="Địa điểm mong muốn" value={locations} onChange={setLocations} options={data.options.locations.map((value) => ({ label: value, value }))} />
            </div>
          </Card>

          <Card>
            <SectionHeader title="Hình thức làm việc" />
            <div className="grid gap-4 md:grid-cols-2">
              <MultiSelect label="Loại hình công việc" value={jobTypes} onChange={setJobTypes} options={data.options.jobTypes.map((value) => ({ label: value, value }))} />
              <MultiSelect label="Onsite, hybrid hoặc remote" value={workModes} onChange={setWorkModes} options={data.options.workModes.map((value) => ({ label: value, value }))} />
              <Input label="Ngày có thể bắt đầu" type="date" error={errors.availableFrom?.message} {...register("availableFrom")} />
            </div>
          </Card>

          <Card>
            <SectionHeader title="Tùy chọn linh hoạt" />
            <div className="space-y-4">
              <Switch label="Sẵn sàng đi công tác" checked={watchedValues.willingToTravel} onChange={(value) => setValue("willingToTravel", value, { shouldDirty: true })} />
              <Switch label="Sẵn sàng chuyển nơi ở" checked={watchedValues.willingToRelocate} onChange={(value) => setValue("willingToRelocate", value, { shouldDirty: true })} />
              <Switch label="Cho phép nhận việc remote quốc tế" checked={watchedValues.internationalRemote} onChange={(value) => setValue("internationalRemote", value, { shouldDirty: true })} />
            </div>
          </Card>

          <Card>
            <SectionHeader title="Từ khóa công việc không mong muốn" />
            <div className="flex gap-2">
              <Input label="Thêm từ khóa" value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder="Ca đêm, không lương..." />
              <Button type="button" className="self-end" icon={<Plus size={16} />} onClick={addKeyword}>Thêm</Button>
            </div>
            <ChipList items={excludedKeywords} onRemove={(item) => setExcludedKeywords((current) => current.filter((value) => value !== item))} />
          </Card>
        </main>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <SectionHeader title="Xem trước" description="Tóm tắt mong muốn nghề nghiệp sẽ dùng để gợi ý việc làm." />
            <div className="space-y-3 text-sm text-slate-700">
              <PreviewRow label="Vị trí" value={desiredPositions.join(", ") || "Chưa chọn"} />
              <PreviewRow label="Địa điểm" value={locations.join(", ") || "Chưa chọn"} />
              <PreviewRow label="Mức lương" value={`${formatMoney(watchedValues.salaryMin)} - ${formatMoney(watchedValues.salaryMax)} ${watchedValues.currency}`} />
              <PreviewRow label="Hình thức" value={[...jobTypes, ...workModes].join(", ") || "Chưa chọn"} />
              <PreviewRow label="Ngày có thể bắt đầu" value={watchedValues.availableFrom || "Chưa chọn"} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {watchedValues.willingToTravel ? <StatusBadge label="Sẵn sàng công tác" tone="success" /> : null}
              {watchedValues.willingToRelocate ? <StatusBadge label="Có thể chuyển nơi ở" tone="success" /> : null}
              {watchedValues.internationalRemote ? <StatusBadge label="Remote quốc tế" tone="success" /> : null}
            </div>
          </Card>

          <Card>
            <Button type="submit" className="w-full" icon={<Save size={16} />} loading={isSubmitting}>Lưu thiết lập</Button>
            {listError ? <p className="mt-3 text-sm text-red-600">{listError}</p> : null}
          </Card>
        </aside>
      </form>
    </PageContainer>
  );
}

function ChipList({ items, onRemove }: { items: string[]; onRemove: (item: string) => void }) {
  if (!items.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => (
        <button key={item} type="button" onClick={() => onRemove(item)} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
          {item} <X size={12} />
        </button>
      ))}
    </div>
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

function formatMoney(value: number) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function formatExperience(
  experienceYears: number | null | undefined,
  experienceLabel: string | null | undefined,
) {
  const label = experienceLabel?.trim();
  if (label) return label;
  if (typeof experienceYears === "number" && Number.isFinite(experienceYears)) {
    return `${experienceYears} năm`;
  }
  return "Chưa có dữ liệu";
}

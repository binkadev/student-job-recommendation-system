import { Star } from "lucide-react";

export function Rating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${value}/${max} điểm`}>
      {Array.from({ length: max }).map((_, index) => (
        <Star key={index} size={16} className={index < value ? "fill-amber-400 text-amber-400" : "text-slate-300"} />
      ))}
    </div>
  );
}

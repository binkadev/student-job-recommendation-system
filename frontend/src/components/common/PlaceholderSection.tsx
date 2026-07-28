import { Link } from "react-router-dom";

interface PlaceholderSectionProps {
  label?: string;
  nextPath?: string;
  nextLabel?: string;
}

export function PlaceholderSection({ label, nextPath, nextLabel }: PlaceholderSectionProps) {
  return (
    <section className="rounded-lg border border-dashed border-slate-300 bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-600">
        {label ?? "Nội dung trang sẽ được phát triển chi tiết ở bước tiếp theo."}
      </p>
      {nextPath ? (
        <Link
          to={nextPath}
          className="mt-5 inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {nextLabel ?? "Tiếp tục"}
        </Link>
      ) : null}
    </section>
  );
}

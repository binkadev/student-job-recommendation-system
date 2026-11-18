import { ChevronRight, Home } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { breadcrumbLabels } from "../../constants/breadcrumbs";

function humanize(segment: string) {
  if (segment.startsWith(":")) return "Chi tiet";
  return breadcrumbLabels[segment] ?? segment.replaceAll("-", " ");
}

export function Breadcrumb() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-[#4B5C73]">
      <Link to="/" className="inline-flex items-center gap-1 transition-colors hover:text-[#134B43]">
        <Home size={14} />
        Trang chủ
      </Link>
      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join("/")}`;
        const isLast = index === segments.length - 1;
        return (
          <span key={href} className="inline-flex items-center gap-1.5">
            <ChevronRight size={14} className="text-slate-400" />
            {isLast ? (
              <span className="font-semibold text-[#0C111C]">{humanize(segment)}</span>
            ) : (
              <Link to={href} className="transition-colors hover:text-[#134B43]">
                {humanize(segment)}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

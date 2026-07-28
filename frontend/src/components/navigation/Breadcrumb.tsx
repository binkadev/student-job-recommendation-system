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
    <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-slate-500">
      <Link to="/" className="inline-flex items-center gap-1 hover:text-brand-600">
        <Home size={14} />
        Trang chủ
      </Link>
      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join("/")}`;
        const isLast = index === segments.length - 1;
        return (
          <span key={href} className="inline-flex items-center gap-1">
            <ChevronRight size={14} />
            {isLast ? (
              <span className="font-medium text-slate-700">{humanize(segment)}</span>
            ) : (
              <Link to={href} className="hover:text-brand-600">
                {humanize(segment)}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

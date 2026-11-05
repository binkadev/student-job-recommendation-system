import { Info } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "../ui/Card";

export function UnsupportedFeature({ title, description, to, action }: { title: string; description: string; to: string; action: string }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <Info aria-hidden="true" size={22} className="mt-1 shrink-0 text-brand-700" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-800">Chức năng chưa được hỗ trợ</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
          <Link to={to} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:ring-4 focus-visible:ring-brand-200">{action}</Link>
        </div>
      </div>
    </Card>
  );
}

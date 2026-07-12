import { X } from "lucide-react";
import type { MenuItem } from "../../types/navigation";
import { Sidebar } from "./Sidebar";

interface MobileSidebarProps {
  open: boolean;
  title: string;
  items: MenuItem[];
  onClose: () => void;
}

export function MobileSidebar({ open, title, items, onClose }: MobileSidebarProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-label="Đóng menu" />
      <div className="relative h-full w-80 max-w-[85vw] bg-white shadow-xl">
        <button className="absolute right-3 top-3 z-10 rounded-md border border-slate-200 bg-white p-2" onClick={onClose}>
          <X size={18} />
        </button>
        <Sidebar title={title} items={items} onNavigate={onClose} />
      </div>
    </div>
  );
}

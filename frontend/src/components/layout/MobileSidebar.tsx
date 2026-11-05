import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import type { MenuItem } from "../../types/navigation";
import { Sidebar } from "./Sidebar";

interface MobileSidebarProps {
  open: boolean;
  title: string;
  items: MenuItem[];
  onClose: () => void;
  neoAppearance?: boolean;
}

export function MobileSidebar({ open, title, items, onClose, neoAppearance = false }: MobileSidebarProps) {
  const dialogRef = useDialogFocus(open, onClose);
  useEffect(() => {
    if (!open) return;
    const media = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (media.matches) onClose(); };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, [open, onClose]);
  if (!open) return null;

  return createPortal(
    <div className={`${neoAppearance ? "neo-mobile " : ""}fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden`} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="relative h-full w-72 max-w-[90vw] bg-white shadow-xl [&>aside]:w-full">
        <button type="button" aria-label="Đóng menu" className="absolute right-3 top-3 z-10 rounded-xl border border-slate-200 bg-white p-2.5" onClick={onClose}>
          <X size={18} />
        </button>
        <Sidebar title={title} items={items} onNavigate={onClose} />
      </section>
    </div>, document.body
  );
}

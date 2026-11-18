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
  variant?: "candidate" | "recruiter" | "admin";
}

export function MobileSidebar({
  open,
  title,
  items,
  onClose,
  neoAppearance = true,
  variant = "candidate",
}: MobileSidebarProps) {
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
    <div
      className={`${neoAppearance ? "neo-mobile " : ""}fixed inset-0 z-40 bg-[#0C111C]/70 backdrop-blur-sm lg:hidden`}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="nova-left-drawer relative h-full w-80 max-w-[90vw] bg-[#0C111C] shadow-2xl [&>aside]:w-full"
      >
        <button
          type="button"
          aria-label="Đóng menu"
          className="absolute right-4 top-[27px] z-10 inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/15 bg-[#1B2533] text-[#F7F8F6] transition-colors hover:border-[#D5F36A]/50 hover:bg-[#243244]"
          onClick={onClose}
        >
          <X size={18} />
        </button>
        <Sidebar title={title} items={items} variant={variant} onNavigate={onClose} mobileDrawer />
      </section>
    </div>, document.body
  );
}

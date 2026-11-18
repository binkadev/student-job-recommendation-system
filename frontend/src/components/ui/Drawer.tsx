import { X } from "lucide-react";
import { useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "../../hooks/useDialogFocus";

interface DrawerProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export function Drawer({ open, title, children, onClose }: DrawerProps) {
  const titleId = useId();
  const dialogRef = useDialogFocus(open, onClose);
  if (!open) return null;
  return createPortal(
    <div
      className="nova-modal-backdrop fixed inset-0 z-50"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <aside
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="nova-drawer-panel absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto overscroll-contain bg-white"
      >
        <div className="flex items-center justify-between border-b border-[#E2E8EE] px-5 py-4">
          <h2 id={titleId} className="text-base font-bold tracking-tight text-[#0C111C]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-transparent p-2.5 text-[#4B5C73] transition-colors hover:border-[#E2E8EE] hover:bg-[#F7F8F6] hover:text-[#0C111C]"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </aside>
    </div>, document.body
  );
}

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
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto overscroll-contain bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100" aria-label="Đóng">
            <X size={18} />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </aside>
    </div>, document.body
  );
}

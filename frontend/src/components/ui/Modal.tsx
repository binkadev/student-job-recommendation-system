import { X } from "lucide-react";
import { useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "../../hooks/useDialogFocus";

interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  size?: "md" | "lg" | "xl";
}

const sizes = {
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

export function Modal({ open, title, children, onClose, size = "md" }: ModalProps) {
  const titleId = useId();
  const dialogRef = useDialogFocus(open, onClose);

  if (!open) return null;

  return createPortal(
    <div
      className="nova-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`nova-modal-panel relative flex max-h-[calc(100dvh-2rem)] w-full flex-col ${sizes[size]} overflow-hidden bg-white`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E2E8EE] px-5 py-4">
          <h2 id={titleId} className="text-base font-bold tracking-tight text-[#0C111C]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-transparent p-2.5 text-[#4B5C73] transition-colors hover:border-[#E2E8EE] hover:bg-[#F7F8F6] hover:text-[#0C111C]"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain p-5 sm:p-6">{children}</div>
      </section>
    </div>, document.body
  );
}

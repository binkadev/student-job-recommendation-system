import { useEffect, useRef } from "react";

const dialogs: HTMLElement[] = [];
const focusableSelector = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
let originalOverflow = "";

/** Keep keyboard interaction in the topmost dialog and return focus on close. */
export function useDialogFocus(open: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    if (!dialogs.length) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    dialogs.push(dialog);
    const getTargets = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
      .filter((element) => !element.closest('[hidden], [inert], [aria-hidden="true"]'));
    (getTargets()[0] ?? dialog).focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (dialogs[dialogs.length - 1] !== dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const targets = getTargets();
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (!first) {
        event.preventDefault();
        dialog?.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    function handleFocus(event: FocusEvent) {
      if (dialogs[dialogs.length - 1] === dialog && !dialog?.contains(event.target as Node)) {
        (getTargets()[0] ?? dialog)?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocus);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocus);
      dialogs.splice(dialogs.indexOf(dialog), 1);
      if (!dialogs.length) document.body.style.overflow = originalOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);
  return dialogRef;
}

import { useEffect, useRef, type KeyboardEvent } from "react";

export function useMenuKeyboard(open: boolean, onOpenChange: (open: boolean) => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const changeRef = useRef(onOpenChange);
  useEffect(() => { changeRef.current = onOpenChange; }, [onOpenChange]);
  useEffect(() => {
    if (!open) return;
    containerRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    function handleOutside(event: MouseEvent | FocusEvent) {
      if (!containerRef.current?.contains(event.target as Node)) changeRef.current(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("focusin", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("focusin", handleOutside);
    };
  }, [open]);
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      changeRef.current(false);
      containerRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (!open) { changeRef.current(true); return; }
    const items = Array.from(containerRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const current = items.indexOf(document.activeElement as HTMLElement);
    const index = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
      : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[index]?.focus();
  }
  return { containerRef, onKeyDown };
}

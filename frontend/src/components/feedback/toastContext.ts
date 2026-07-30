import { createContext, useContext } from "react";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  title: string;
  message?: string;
  type: ToastType;
}

export interface ToastContextValue {
  showToast: (toast: Omit<Toast, "id">) => void;
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToastContext() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}

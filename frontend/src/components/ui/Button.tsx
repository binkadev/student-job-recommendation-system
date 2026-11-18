import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-[#1A6359] text-white shadow-sm hover:bg-[#134B43] hover:shadow-soft active:bg-[#0D332E]",
  secondary: "border border-[#D5DCE6] bg-white text-[#0C111C] shadow-sm hover:border-[#237D70]/50 hover:bg-[#F0FAF8]",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
  ghost: "text-[#1B2533] hover:bg-[#F0FAF8] hover:text-[#134B43]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-1.5 text-sm",
  md: "min-h-10 px-4 py-2 text-sm",
  lg: "min-h-11 px-5 py-2.5 text-base",
};

export function Button({ variant = "primary", size = "md", icon, loading = false, disabled, children, className = "", ...props }: ButtonProps) {
  return (
    <button
      type={props.type ?? "button"}
      aria-busy={loading || undefined}
      className={`neo-button neo-button-${variant} inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 focus-visible:ring-4 focus-visible:ring-[#aee6dc] disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : icon}
      {children}
    </button>
  );
}

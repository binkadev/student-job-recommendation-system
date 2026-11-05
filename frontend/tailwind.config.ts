import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "rgb(var(--brand-50-rgb, 239 246 255) / <alpha-value>)", 100: "rgb(var(--brand-100-rgb, 219 234 254) / <alpha-value>)", 200: "rgb(var(--brand-200-rgb, 191 219 254) / <alpha-value>)",
          300: "rgb(var(--brand-300-rgb, 147 197 253) / <alpha-value>)", 400: "rgb(var(--brand-400-rgb, 96 165 250) / <alpha-value>)", 500: "rgb(var(--brand-500-rgb, 37 99 235) / <alpha-value>)",
          600: "rgb(var(--brand-600-rgb, 29 78 216) / <alpha-value>)", 700: "rgb(var(--brand-700-rgb, 30 64 175) / <alpha-value>)", 800: "rgb(var(--brand-800-rgb, 30 58 138) / <alpha-value>)", 900: "rgb(var(--brand-900-rgb, 23 37 84) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 3px 16px -6px rgba(15, 23, 42, 0.10)",
        lift: "0 16px 35px -15px rgba(15, 23, 42, 0.18)",
      },
    },
  },
  plugins: [],
} satisfies Config;

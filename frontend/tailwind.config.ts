import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "rgb(var(--brand-50-rgb, 240 250 248) / <alpha-value>)",
          100: "rgb(var(--brand-100-rgb, 214 242 236) / <alpha-value>)",
          200: "rgb(var(--brand-200-rgb, 174 230 220) / <alpha-value>)",
          300: "rgb(var(--brand-300-rgb, 120 210 195) / <alpha-value>)",
          400: "rgb(var(--brand-400-rgb, 66 182 163) / <alpha-value>)",
          500: "rgb(var(--brand-500-rgb, 35 125 112) / <alpha-value>)",
          600: "rgb(var(--brand-600-rgb, 26 99 89) / <alpha-value>)",
          700: "rgb(var(--brand-700-rgb, 19 75 67) / <alpha-value>)",
          800: "rgb(var(--brand-800-rgb, 13 51 46) / <alpha-value>)",
          900: "rgb(var(--brand-900-rgb, 6 28 25) / <alpha-value>)",
        },
        nova: {
          midnight: "#0C111C",
          graphite: "#1B2533",
          porcelain: "#F7F8F6",
          lime: "#D5F36A",
          coral: "#FF7956",
          teal: "#237D70",
        },
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 4px 20px -4px rgba(12, 17, 28, 0.06)",
        lift: "0 18px 40px -14px rgba(12, 17, 28, 0.16)",
      },
    },
  },
  plugins: [],
} satisfies Config;

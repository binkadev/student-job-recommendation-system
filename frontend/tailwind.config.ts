import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe",
          300: "#93c5fd", 400: "#60a5fa", 500: "#2563eb",
          600: "#1d4ed8", 700: "#1e40af", 800: "#1e3a8a", 900: "#172554",
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
